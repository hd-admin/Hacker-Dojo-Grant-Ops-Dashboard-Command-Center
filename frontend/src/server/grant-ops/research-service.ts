/**
 * Research Service
 *
 * Handles on-demand grant research using Opencode and stored sources.
 * Crawls sources, normalizes findings, ranks by fit/deadline/award, and persists evidence.
 *
 * This service uses the DI boundary from dependencies.ts for all external dependencies.
 * Production behavior: requires configured Opencode settings.
 */

import type {
  CrawlRun,
  Grant,
  OrganizationProfile,
  Source,
} from '../../../../shared/types';
import {
  createDefaultFitBreakdown,
  createDefaultFunderSummary,
  createDefaultGrantChecklist,
} from '../../../../shared/seed-data';
import { getDependencies, type Clock, type IdGenerator } from './dependencies';

export interface ResearchOptions {
  /**
   * @internal Test-only option. Do not use in production code.
   */
  _providerType?: 'cli' | 'fake';
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
    // Get active sources
    const sources = await deps.sourceService.getActiveSources();

    // If no sources, create a default one based on search themes
    if (sources.length === 0) {
      const defaultSource = await deps.sourceService.addSource({
        name: 'Default Search',
        url: 'https://www.candid.org',
        type: 'website',
      });
      sources.push(defaultSource);
    }

    const settings = await deps.repository.getOpencodeSettings();

    // Determine provider type - use internal _providerType if set (test-only), otherwise require CLI with config
    const providerType = options._providerType || 'cli';

    if (providerType === 'cli') {
      if (!settings?.isConfigured) {
        throw new Error(
          'Opencode is not configured. Please set up Opencode settings in the application before running research.',
        );
      }
    }

    // Create Opencode adapter using DI
    const adapter = deps.createOpencodeAdapter(settings!, providerType);

    const result = await performResearch(profile, sources, adapter, deps, clock, idGenerator);
    return result;
  } catch (error) {
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

async function performResearch(
  profile: OrganizationProfile,
  sources: Source[],
  adapter: ReturnType<ReturnType<typeof getDependencies>['createOpencodeAdapter']>,
  deps: ReturnType<typeof getDependencies>,
  clock: Clock,
  idGenerator: IdGenerator,
): Promise<ResearchResult> {
  let totalGrantsFound = 0;
  let totalGrantsMatched = 0;
  const existingGrants = await deps.repository.getGrants();

  // Process each source
  for (const source of sources) {
    try {
      // Use Opencode to research grants
      const response = await adapter.executeResearch({
        organizationProfile: `${profile.legalName}\n\nMission: ${profile.mission}`,
        searchThemes: profile.searchThemes,
        sourceName: source.name,
        sourceUrl: source.url,
      });

      if (response.success && response.content) {
        // Parse the response (expecting JSON)
        let researchData: { grants?: Array<{
          id?: string;
          title: string;
          funder: string;
          funderShort?: string;
          award?: string;
          awardSort?: number;
          deadline?: string;
          daysOut?: number;
          fit?: number;
          tags?: string[];
        }> };
        try {
          researchData = JSON.parse(response.content) as typeof researchData;
        } catch {
          throw new Error(
            `Failed to parse research response from Opencode for source ${source.name}. Expected JSON format.`,
          );
        }

        const grants = researchData.grants || [];
        totalGrantsFound += grants.length;

        // Add new grants
        for (const grantData of grants) {
          // Check if grant already exists
          const existing = existingGrants.find(
            (g) => g.title === grantData.title && g.funder === grantData.funder!,
          );

          if (!existing) {
            const fallbackDeadline = new Date(clock.now().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
            const deadline = grantData.deadline ?? fallbackDeadline;
            const newGrant: Grant = {
              id: grantData.id || idGenerator.generateId('grant'),
              title: grantData.title!,
              funder: grantData.funder!,
              funderShort: grantData.funderShort || grantData.funder!.substring(0, 10),
              award: grantData.award || `$${grantData.awardSort?.toLocaleString() || '0'}`,
              awardSort: grantData.awardSort || 0,
              deadline,
              daysOut: grantData.daysOut ?? calculateDaysOut(deadline, clock.now()),
              fit: grantData.fit || 70,
              tags: grantData.tags || profile.searchThemes.slice(0, 2),
              status: 'matched',
              statusLabel: 'Matched',
              matchedAt: clock.now().toISOString(),
              fitBreakdown: createDefaultFitBreakdown(grantData.fit || 70),
              funderSummary: createDefaultFunderSummary({
                title: grantData.title!,
                funder: grantData.funder!,
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
            };

            await deps.repository.addGrant(newGrant);
            existingGrants.push(newGrant);
            totalGrantsMatched++;
          } else {
            const updatedSourceCount = (existing.sourceCount ?? 0) + 1;
            const updatedGrant: Partial<Grant> = {
              sourceCount: updatedSourceCount,
              fitBreakdown: existing.fitBreakdown ?? createDefaultFitBreakdown(existing.fit),
              funderSummary: existing.funderSummary ?? createDefaultFunderSummary(existing),
              checklist: existing.checklist ?? createDefaultGrantChecklist({
                ...existing,
                sourceCount: updatedSourceCount,
              }),
            };
            await deps.repository.updateGrant(existing.id, updatedGrant);
            Object.assign(existing, updatedGrant);
          }
        }

        // Update source last crawled
        await deps.sourceService.updateSourceLastCrawled(source.id);
      }
    } catch (error) {
      console.error(`Error crawling source ${source.name}:`, error);
    }
  }

  // Update crawl run with results and persist
  const updatedCrawlRun = await deps.repository.getLatestCrawlRun();
  if (updatedCrawlRun) {
    updatedCrawlRun.completedAt = clock.now().toISOString();
    updatedCrawlRun.status = 'completed';
    updatedCrawlRun.sourcesCrawled = sources.length;
    updatedCrawlRun.grantsFound = totalGrantsFound;
    updatedCrawlRun.grantsMatched = totalGrantsMatched;
    await deps.repository.updateCrawlRun(updatedCrawlRun);
  }

  return {
    crawlRun: updatedCrawlRun!,
    grantsFound: totalGrantsFound,
    grantsMatched: totalGrantsMatched,
  };
}

function calculateDaysOut(deadline: string, now: Date = new Date()): number {
  if (!deadline) return 0;
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export async function getLatestCrawlRun(): Promise<CrawlRun | null> {
  const deps = getDependencies();
  return deps.repository.getLatestCrawlRun();
}

export async function getCrawlRuns(): Promise<CrawlRun[]> {
  const deps = getDependencies();
  return deps.repository.getCrawlRuns();
}
