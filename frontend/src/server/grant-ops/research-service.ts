import 'server-only';
/**
 * Research Service
 *
 * Handles on-demand grant research using Opencode and stored sources.
 * Crawls sources, normalizes findings, ranks by fit/deadline/award, and persists evidence.
 *
 * This service uses the DI boundary from dependencies.ts for all external dependencies.
 * Production behavior: requires configured Opencode settings.
 */

import { logger } from '@/lib/logger';
import { ResearchResponseSchema } from '../../../../shared/schemas';
import type {
  CrawlRun,
  Grant,
  Notification,
  OpencodeSettings,
  OrganizationProfile,
  ResearchEvidence,
  Source,
} from '../../../../shared/types';
import { escapeForHtml } from '../../lib/sanitize-html';
import { type Clock, getDependencies, type IdGenerator } from './dependencies';
import { ensureProPublicaSourceRegistered } from './propublica-service';
import { scoreGrantByThemes } from './theme-service';

export class NoSourcesConfiguredError extends Error {
  public readonly code = 'NO_SOURCES_CONFIGURED';

  constructor() {
    super('No sources configured. Add funding sources in Sources before running discovery.');
    this.name = 'NoSourcesConfiguredError';
  }
}

/**
 * Create a default fit score breakdown from an overall fit score.
 * Distributes the score evenly across all dimensions.
 */
function createDefaultFitBreakdown(
  fit: number,
): import('../../../../shared/types').FitScoreBreakdown {
  const normalized = Math.min(100, Math.max(0, fit)) / 100;
  return {
    missionAlignment: normalized,
    geographicFocus: normalized,
    programTrackrecord: normalized,
    budgetCapacity: normalized,
    partnershipReadiness: normalized,
  };
}

/**
 * Create a default funder summary when none is provided.
 * Returns empty string - no fake funder summary should be generated.
 */
function createDefaultFunderSummary(grant: Pick<Grant, 'funder' | 'title' | 'tags'>): string {
  return `${grant.funder} is a funding organization that supports grants including ${grant.title}.`;
}

/**
 * Create a default grant checklist when none is provided.
 * Returns empty array - real checklist items should be generated from grant requirements.
 */
function createDefaultGrantChecklist(
  grant: Pick<
    Grant,
    | 'fit'
    | 'status'
    | 'draftContent'
    | 'funderSummary'
    | 'latestDraftVersion'
    | 'groundedDocumentCount'
    | 'sourceCount'
  >,
): Array<{ label: string; done: boolean; source: string }> {
  const items = [
    { label: 'Review eligibility requirements', done: false, source: 'system' },
    { label: 'Verify organization fit score', done: (grant.fit ?? 0) >= 70, source: 'system' },
    {
      label: 'Generate draft proposal',
      done: (grant.latestDraftVersion ?? 0) > 0,
      source: 'system',
    },
  ];
  return items;
}

export interface ResearchOptions {
  /**
   * @internal Test-only option. Do not use in production code.
   */
  _providerType?: 'cli' | 'fake';
  sourceIds?: string[];
}

export interface ResearchResult {
  crawlRun: CrawlRun;
  grantsFound: number;
  grantsMatched: number;
  error?: string;
}

export async function runResearch(
  profile: OrganizationProfile,
  options: ResearchOptions = {},
): Promise<ResearchResult> {
  const deps = getDependencies();
  const clock = deps.clock;
  const idGenerator = deps.idGenerator;

  const startTime = clock.now().toISOString();
  const crawlRunId = idGenerator.generateId('crawl');

  // Create initial crawl run record
  const crawlRun: CrawlRun = {
    id: crawlRunId,
    startedAt: startTime,
    status: 'running',
    sourcesCrawled: 0,
    grantsFound: 0,
    grantsMatched: 0,
  };

  await deps.repository.addCrawlRun(crawlRun);

  try {
    // Ensure ProPublica is registered as a default source before checking active sources
    await ensureProPublicaSourceRegistered(deps);

    // Get active sources
    let sources = await deps.sourceService.getActiveSources();
    if (options.sourceIds?.length) {
      const sourceIdSet = new Set(options.sourceIds);
      sources = sources.filter((source) => sourceIdSet.has(source.id));
      if (sources.length === 0) {
        throw new Error(
          `No active sources matched the requested source scope: ${options.sourceIds.join(', ')}`,
        );
      }
    }

    // If no sources, return an error instead of silently creating a default
    if (sources.length === 0) {
      throw new NoSourcesConfiguredError();
    }

    const settings = await deps.repository.getOpencodeSettings();
    const providerType = options._providerType || 'cli';

    // Create Opencode adapter using DI
    const defaultSettings: OpencodeSettings = {
      binaryPath: '',
      workingDirectory: '',
      timeoutMs: 300000,
      isConfigured: false,
    };
    const adapter = deps.createOpencodeAdapter(settings || defaultSettings, providerType);

    const result = await performResearch(
      profile,
      sources,
      adapter,
      deps,
      clock,
      idGenerator,
      crawlRun,
    );
    return result;
  } catch (error) {
    // Let NoSourcesConfiguredError propagate to the API route for proper HTTP 409
    if (error instanceof NoSourcesConfiguredError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update crawl run with error and persist
    crawlRun.completedAt = clock.now().toISOString();
    crawlRun.status = 'failed';
    crawlRun.errorMessage = errorMessage;
    await deps.repository.updateCrawlRun(crawlRun);

    return {
      crawlRun,
      grantsFound: 0,
      grantsMatched: 0,
      error: errorMessage,
    };
  }
}

/**
 * Build a comprehensive applicant-organization context block for the crawl prompt,
 * so the agent can judge eligibility and fit precisely (not just by mission).
 */
function formatOrgProfileForPrompt(profile: OrganizationProfile): string {
  const lines: string[] = [
    `Legal name: ${profile.legalName}`,
    profile.ein ? `EIN: ${profile.ein}` : '',
    profile.nonprofitStatus ? `Nonprofit status: ${profile.nonprofitStatus}` : '',
    profile.yearFounded ? `Year founded: ${profile.yearFounded}` : '',
    profile.geography ? `Geography served: ${profile.geography}` : '',
    `Mission: ${profile.mission}`,
    profile.programAreas?.length ? `Program areas: ${profile.programAreas.join(', ')}` : '',
    profile.populationsServed?.length
      ? `Populations served: ${profile.populationsServed.join(', ')}`
      : '',
    profile.partnerships?.length ? `Partnerships: ${profile.partnerships.join(', ')}` : '',
    profile.complianceFacts?.length
      ? `Compliance/eligibility facts: ${profile.complianceFacts.join('; ')}`
      : '',
    profile.fundingHistory?.length
      ? `Past funding: ${profile.fundingHistory
          .map((f) => `${f.source} ($${f.amount}, ${f.year})`)
          .join('; ')}`
      : '',
  ];
  return lines.filter(Boolean).join('\n');
}

type ValidatedResearchData = Extract<
  ReturnType<typeof ResearchResponseSchema.safeParse>,
  { success: true }
>['data'];

type SourceResearchOutcome =
  | { researchData: ValidatedResearchData; partial: boolean }
  | { failure: string };

/**
 * Run one source through OpenCode and guarantee the result is schema-valid before it
 * can be ingested. If OpenCode returns output that is not valid, type-checked JSON, it
 * reprompts once with a correction hint. Hard failures (timeout/non-zero exit) are NOT
 * retried (a 60s timeout would just repeat) — they fail fast and loudly.
 */
async function researchSourceWithRetry(
  adapter: ReturnType<ReturnType<typeof getDependencies>['createOpencodeAdapter']>,
  request: {
    organizationProfile: string;
    searchThemes: string[];
    sourceName: string;
    sourceUrl: string;
    existingGrants: Array<{ title: string; funder: string; deadline?: string }>;
  },
): Promise<SourceResearchOutcome> {
  const MAX_ATTEMPTS = 2;
  let lastValidationError = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await adapter.executeResearch(
      attempt === 1 ? request : { ...request, correctionHint: lastValidationError },
    );

    const isPartial = response.failureMode === 'partial-output' && !!response.content;
    if (!response.success && !isPartial) {
      return { failure: response.failureMode || response.error || 'unknown failure' };
    }
    if (!response.content) {
      return { failure: 'opencode returned empty output' };
    }

    try {
      const parsed = parseResearchResponseContent(response.content);
      const validated = ResearchResponseSchema.safeParse(parsed);
      if (validated.success) {
        return { researchData: validated.data, partial: isPartial };
      }
      lastValidationError = `Output did not match the required JSON schema: ${validated.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`;
    } catch (err) {
      lastValidationError = `Output was not valid JSON: ${
        err instanceof Error ? err.message : 'parse error'
      }`;
    }

    logger.warn(
      { attempt, source: request.sourceName, error: lastValidationError },
      'OpenCode research output failed validation; reprompting for corrected JSON',
    );
    // A partial/truncated response is a timeout symptom, not a format mistake —
    // reprompting won't help, so stop.
    if (isPartial) break;
  }

  return { failure: `parse-error: ${lastValidationError}` };
}

async function performResearch(
  profile: OrganizationProfile,
  sources: Source[],
  adapter: ReturnType<ReturnType<typeof getDependencies>['createOpencodeAdapter']>,
  deps: ReturnType<typeof getDependencies>,
  clock: Clock,
  idGenerator: IdGenerator,
  initialCrawlRun: CrawlRun,
): Promise<ResearchResult> {
  let totalGrantsFound = 0;
  let totalGrantsMatched = 0;
  let hadPartialOutput = false;
  let succeededSources = 0;
  let failedSources = 0;
  const failureDetails: string[] = [];
  const existingGrants = await deps.repository.getGrants();
  const orgProfileText = formatOrgProfileForPrompt(profile);
  const perGrantNotifications: Notification[] = [];

  // Process each source
  for (const source of sources) {
    let sourceFailed = false;
    let sourceFailureReason = '';
    try {
      // Crawl this source with OpenCode. The output is guaranteed schema-valid (with
      // one corrective reprompt) before anything is ingested — invalid output never
      // becomes a grant; it surfaces as a loud per-source failure instead.
      const outcome = await researchSourceWithRetry(adapter, {
        organizationProfile: orgProfileText,
        searchThemes: profile.searchThemes,
        sourceName: source.name,
        sourceUrl: source.url,
        existingGrants: existingGrants.map((g) => ({
          title: g.title,
          funder: g.funder,
          ...(g.deadline ? { deadline: g.deadline } : {}),
        })),
      });

      await deps.sourceService.updateSourceLastCrawled(source.id);

      if ('failure' in outcome) {
        sourceFailed = true;
        sourceFailureReason = outcome.failure;
        logger.warn({ error: outcome.failure }, `Research failed for source ${source.name}`);
      } else {
        if (outcome.partial) {
          hadPartialOutput = true;
        }
        const researchData = outcome.researchData;
        {
          const grants = researchData.grants || [];
          const evidence = (researchData.evidence || []) as ResearchEvidence[];
          totalGrantsFound += grants.length;

          // Add new grants
          for (const grantData of grants) {
            const title = grantData.title;
            const funder = grantData.funder;
            if (!title || !funder) {
              continue;
            }

            const grantEvidence = evidence.filter((item) => item.grantId === grantData.id);
            const researchRationale = researchData.rationale;

            // Check if grant already exists
            const existing = existingGrants.find((g) => g.title === title && g.funder === funder);

            if (!existing) {
              const fallbackDeadline = new Date(clock.now().getTime() + 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);
              const deadline = grantData.deadline ?? fallbackDeadline;
              const newGrant: Grant = {
                id: grantData.id || idGenerator.generateId('grant'),
                title,
                funder,
                funderShort: grantData.funderShort || funder.substring(0, 10),
                award: grantData.award || `$${grantData.awardSort?.toLocaleString() || '0'}`,
                awardSort: grantData.awardSort || 0,
                deadline,
                daysOut: grantData.daysOut ?? calculateDaysOut(deadline, clock.now()),
                fit:
                  grantData.fit ??
                  (await scoreGrantByThemes(grantData.tags ?? profile.searchThemes.slice(0, 2))),
                tags: grantData.tags || profile.searchThemes.slice(0, 2),
                status: 'matched',
                statusLabel: 'Matched',
                matchedAt: clock.now().toISOString(),
                fitBreakdown: createDefaultFitBreakdown(grantData.fit || 70),
                funderSummary: createDefaultFunderSummary({
                  title,
                  funder,
                  tags: grantData.tags || profile.searchThemes.slice(0, 2),
                }),
                checklist: createDefaultGrantChecklist({
                  fit: grantData.fit || 70,
                  status: 'matched',
                  latestDraftVersion: 0,
                  groundedDocumentCount: 0,
                  sourceCount: 1,
                }),
                latestDraftVersion: 0,
                groundedDocumentCount: 0,
                sourceCount: 1,
                researchEvidence: grantEvidence,
                ...(researchRationale ? { researchRationale } : {}),
              };

              await deps.repository.addGrant(newGrant);
              existingGrants.push(newGrant);
              totalGrantsMatched++;

              perGrantNotifications.push({
                id: idGenerator.generateId('notification'),
                dot: 'accent',
                time: clock.now().toISOString(),
                text: `New match: <strong>${escapeForHtml(newGrant.title)}</strong> · ${escapeForHtml(newGrant.funder)} · ${escapeForHtml(newGrant.award)} · fit ${newGrant.fit}`,
              });
            } else {
              const updatedSourceCount = (existing.sourceCount ?? 0) + 1;
              const mergedEvidence = mergeResearchEvidence(
                existing.researchEvidence,
                grantEvidence,
              );
              const mergedRationale = existing.researchRationale ?? researchRationale;
              const updatedGrant: Partial<Grant> = {
                sourceCount: updatedSourceCount,
                fitBreakdown: existing.fitBreakdown ?? createDefaultFitBreakdown(existing.fit),
                funderSummary: existing.funderSummary ?? createDefaultFunderSummary(existing),
                checklist:
                  existing.checklist ??
                  createDefaultGrantChecklist({
                    ...existing,
                    sourceCount: updatedSourceCount,
                  }),
                researchEvidence: mergedEvidence,
                ...(mergedRationale ? { researchRationale: mergedRationale } : {}),
              };
              await deps.repository.updateGrant(existing.id, updatedGrant);
              Object.assign(existing, updatedGrant);
            }
          }
        }
      }
    } catch (error) {
      // Includes parse failures (OpenCode returned exit 0 but unparseable output) —
      // counted as a real failure, never silently dropped.
      sourceFailed = true;
      sourceFailureReason = error instanceof Error ? error.message : 'crawl error';
      logger.error({ err: error }, `Error crawling source ${source.name}`);
      // No fallback grant creation: failed crawls should not invent matches.
    }

    if (sourceFailed) {
      failedSources++;
      failureDetails.push(`${source.name}: ${sourceFailureReason}`);
    } else {
      succeededSources++;
    }
  }

  // Determine the run's status honestly. Zero grants is NOT a failure — only an
  // actual OpenCode failure/timeout/parse-error is. This is what makes a broken
  // crawl surface loudly (failed/partial) instead of looking like a clean empty run.
  const allFailed = sources.length > 0 && failedSources === sources.length;
  const someFailed = failedSources > 0 && !allFailed;
  const errorSummary = failureDetails.join('; ');

  initialCrawlRun.completedAt = clock.now().toISOString();
  if (allFailed) {
    initialCrawlRun.status = 'failed';
    initialCrawlRun.errorMessage = `All ${sources.length} source(s) failed: ${errorSummary}`;
  } else if (someFailed) {
    initialCrawlRun.status = 'partial-results';
    initialCrawlRun.errorMessage = `${failedSources} of ${sources.length} source(s) failed: ${errorSummary}`;
  } else {
    initialCrawlRun.status = hadPartialOutput ? 'partial-results' : 'completed';
  }
  initialCrawlRun.sourcesCrawled = succeededSources;
  initialCrawlRun.grantsFound = totalGrantsFound;
  initialCrawlRun.grantsMatched = totalGrantsMatched;
  await deps.repository.updateCrawlRun(initialCrawlRun);

  const notifications = await deps.repository.getNotifications();
  const summaryNotification: Notification = {
    id: idGenerator.generateId('notification'),
    dot: allFailed ? 'alert' : someFailed ? 'warn' : 'success',
    time: clock.now().toISOString(),
    text: allFailed
      ? `Crawl failed: all ${sources.length} source(s) errored. ${errorSummary}`
      : someFailed
        ? `Crawl partial: ${totalGrantsMatched} match(es) from ${succeededSources}/${sources.length} source(s); ${failedSources} failed.`
        : `Research completed: ${totalGrantsMatched} new grant(s) matched across ${succeededSources} source(s)`,
  };
  const updatedNotifications = [...perGrantNotifications, summaryNotification, ...notifications];
  await deps.repository.updateNotifications(updatedNotifications);

  return {
    crawlRun: initialCrawlRun,
    grantsFound: totalGrantsFound,
    grantsMatched: totalGrantsMatched,
    ...(initialCrawlRun.errorMessage ? { error: initialCrawlRun.errorMessage } : {}),
  };
}

function calculateDaysOut(deadline: string, now: Date = new Date()): number {
  if (!deadline) return 0;
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function parseResearchResponseContent(content: string): unknown {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1].trim()) as unknown;
  }

  return JSON.parse(trimmed) as unknown;
}

function mergeResearchEvidence(
  existingEvidence: ResearchEvidence[] | undefined,
  incomingEvidence: ResearchEvidence[],
): ResearchEvidence[] {
  const merged = new Map<string, ResearchEvidence>();

  for (const evidence of existingEvidence ?? []) {
    merged.set(evidence.id, evidence);
  }

  for (const evidence of incomingEvidence) {
    merged.set(evidence.id, evidence);
  }

  return [...merged.values()];
}

export async function getLatestCrawlRun(): Promise<CrawlRun | null> {
  const deps = getDependencies();
  return deps.repository.getLatestCrawlRun();
}

export async function getCrawlRuns(): Promise<CrawlRun[]> {
  const deps = getDependencies();
  return deps.repository.getCrawlRuns();
}
