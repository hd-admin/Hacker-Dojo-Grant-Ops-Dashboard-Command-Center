import 'server-only';
/**
 * Opencode Client Adapter
 *
 * This module provides a typed adapter for the Opencode CLI tool.
 * It shells out to the configured Opencode binary with appropriate arguments,
 * timeout, and working directory settings.
 *
 * Production path: executes the Opencode CLI with provided arguments
 * Test path: uses a fake provider for deterministic testing
 */

import { spawn } from 'node:child_process';
import type { OpencodeSettings } from '../../../../shared/types';

/**
 * Resolve the opencode binary path, falling back to PATH search when
 * the configured binaryPath is empty.
 *
 * On Unix: uses `which opencode` to locate the binary.
 * On Windows: uses `where opencode` to locate the binary.
 * Falls back to returning null when opencode cannot be found on PATH.
 */
export async function resolveOpencodePath(configuredPath: string): Promise<string | null> {
  if (configuredPath) {
    return configuredPath;
  }

  const { execFile } = await import('node:child_process');
  try {
    const isWindows = process.platform === 'win32';
    const locateCmd = isWindows ? 'where' : 'which';
    const output = await new Promise<string>((resolve, reject) => {
      execFile(locateCmd, ['opencode'], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
    const firstLine = output.trim().split(/\r?\n/)[0]?.trim();
    if (firstLine && firstLine.length > 0) {
      return firstLine;
    }
  } catch {
    // `which`/`where` failed — opencode not on PATH
  }

  return null;
}

// Module-level cached PATH resolution for synchronous isConfigured() check.
// Uses the same platform-aware execFileSync + which/where detection as resolveOpencodePath.
// undefined = not yet tried; null = tried and not found; string = found at path
let cachedResolvedPath: string | null | undefined = undefined;

export function resetCachedOpencodePath(): void {
  cachedResolvedPath = undefined; // allow re-detection next call
}

export function overrideCachedPath(path: string | null): void {
  cachedResolvedPath = path; // set to null to simulate opencode not on PATH
}

function getCachedOpencodePath(): string | null {
  if (cachedResolvedPath !== undefined) {
    return cachedResolvedPath;
  }
  const { execFileSync } = require('node:child_process');
  try {
    const isWindows = process.platform === 'win32';
    const locateCmd = isWindows ? 'where' : 'which';
    const output = execFileSync(locateCmd, ['opencode'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    const firstLine = output.trim().split(/\r?\n/)[0]?.trim();
    cachedResolvedPath = firstLine && firstLine.length > 0 ? firstLine : null;
  } catch {
    cachedResolvedPath = null;
  }
  return cachedResolvedPath ?? null;
}

interface _OpencodeRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

interface GroundingSection {
  sectionTitle: string;
  evidence: string[];
  isGrounded: boolean;
}

interface OpencodeResponse {
  success: boolean;
  content?: string;
  error?: string;
  exitCode?: number;
  failureMode?: OpencodeFailureMode;
  /**
   * Section-level grounding metadata provided by opencode.
   * When absent, groundingSections should fall back to empty array - never fabricate.
   */
  groundingSections?: GroundingSection[];
}

interface GrantResearchRequest {
  organizationProfile: string;
  searchThemes: string[];
  sourceName?: string;
  sourceUrl?: string;
  /** Grants already tracked, so the agent does not return duplicates. */
  existingGrants?: Array<{ title: string; funder: string; deadline?: string }>;
  /** Appended on a retry when the previous output failed schema validation. */
  correctionHint?: string;
}

interface DraftGenerationRequest {
  grantTitle: string;
  grantFunder: string;
  grantAmount?: string;
  grantDeadline?: string;
  organizationProfile: string;
  missionStatement: string;
  previousDraft?: string;
  revisionNotes?: string;
  groundingDocuments?: string[];
}

interface PeerDiscoveryRequest {
  query?: string | undefined;
  organizationProfile: string;
}

interface FunderInsightsRequest {
  funderId: string;
  organizationProfile: string;
}

interface EligibilityVettingRequest {
  grantId: string;
  requirements?: string;
  organizationProfile: string;
}

export type OpencodeFailureMode =
  | 'install-missing'
  | 'config-error'
  | 'rate-limit'
  | 'malformed-output'
  | 'context-overflow'
  | 'partial-output'
  | 'model-unavailable'
  | 'timeout'
  | 'connectivity'
  | 'quota-exhausted'
  | 'capacity'
  | 'interrupted-session'
  | 'unknown';

export type OpencodeProvider = 'cli' | 'fake';

/**
 * Classify an opencode execution error into a standard failure mode.
 * Uses stderr content, error message, and exit code to infer the root cause.
 */
export function classifyOpencodeError(
  errorMessage: string,
  stderr?: string,
  exitCode?: number,
): OpencodeFailureMode {
  const combined = [errorMessage, stderr].filter(Boolean).join(' ').toLowerCase();

  // Install-missing: binary not found on PATH
  if (/command not found|no such file|enoent|not installed/i.test(combined)) {
    return 'install-missing';
  }

  // Config-error: API key missing, profile not found, permission denied
  if (
    /api.key|unauthorized|authentication|permission denied|eacces|not configured|profile.*not found/i.test(
      combined,
    )
  ) {
    return 'config-error';
  }

  // Rate-limit: provider throttling (transient, not quota) - check before quota-exhausted
  if (/429|rate.limit|too many requests|rate exceeded/i.test(combined)) {
    return 'rate-limit';
  }

  // Quota-exhausted: explicit quota exceeded (separate from rate-limit throttling)
  if (/quota exceeded|quota exhausted|billing.*limit|usage limit reached/i.test(combined)) {
    return 'quota-exhausted';
  }

  // Malformed-output: unparseable response, invalid JSON, unexpected format
  if (
    /unexpected token|syntax.?error|malformed|invalid json|parse error|unexpected.*format/i.test(
      combined,
    )
  ) {
    return 'malformed-output';
  }

  // Context-overflow: token limit, context window exceeded
  if (/context length|token limit|maximum context|context.*exceed|too long/i.test(combined)) {
    return 'context-overflow';
  }

  // Interrupted-session: session terminated, connection closed mid-stream
  if (
    /session.*terminat|connection.*closed|stream.*interrupted|hang.?up|sigpipe/i.test(combined) ||
    exitCode === 141
  ) {
    return 'interrupted-session';
  }

  // Partial-output: output truncated, cut off, incomplete response
  if (/truncated|incomplete|partial|cut off|broken pipe/i.test(combined)) {
    return 'partial-output';
  }

  // Capacity: resource exhausted, busy, 503 service unavailable
  if (/resource exhausted|busy|503|service unavailable|overloaded/i.test(combined)) {
    return 'capacity';
  }

  // Model-unavailable: model not found or temporarily unavailable
  if (/model.*not found|model.*unavailable/i.test(combined)) {
    return 'model-unavailable';
  }

  // Timeout: execution exceeded deadline
  if (/timed out|timeout|deadline exceeded/i.test(combined) || exitCode === 124) {
    return 'timeout';
  }

  // Connectivity: network unreachable, connection refused (not binary-not-found)
  if (
    /network.*unreachable|connection refused|econnrefused|enotfound|dns.*resolve/i.test(combined)
  ) {
    return 'connectivity';
  }

  return 'unknown';
}

export interface OpencodeAdapter {
  executeResearch(request: GrantResearchRequest): Promise<OpencodeResponse>;
  generateDraft(request: DraftGenerationRequest): Promise<OpencodeResponse>;
  executePeerDiscovery(request: PeerDiscoveryRequest): Promise<OpencodeResponse>;
  executeFunderInsights(request: FunderInsightsRequest): Promise<OpencodeResponse>;
  executeEligibilityVetting(request: EligibilityVettingRequest): Promise<OpencodeResponse>;
  isConfigured(): boolean;
}

export function normalizeOpencodeOutput(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return '';
  }

  const chunks: string[] = [];
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let parsedAny = false;

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as {
        type?: string;
        part?: { text?: unknown };
      };
      parsedAny = true;
      if (event.type === 'text' && typeof event.part?.text === 'string') {
        chunks.push(event.part.text);
      }
    } catch {
      return trimmed;
    }
  }

  if (!parsedAny || chunks.length === 0) {
    return trimmed;
  }

  return chunks.join('\n').trim();
}

class FakeOpencodeProvider implements OpencodeAdapter {
  private shouldFail = false;

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  async executeResearch(request: GrantResearchRequest): Promise<OpencodeResponse> {
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Fake provider: Opencode binary not found',
        exitCode: 1,
      };
    }

    // Return deterministic mock research data
    const mockResearch = {
      grants: [
        {
          id: `mock-grant-001`,
          title: `${request.searchThemes[0] || 'Technology'} Community Grant`,
          funder: 'Mock Foundation',
          funderShort: 'Mock',
          award: '$50,000',
          awardSort: 50000,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          daysOut: 30,
          fit: 82,
          tags: ['Community', 'Technology'],
          status: 'matched' as const,
          statusLabel: 'Matched',
          matchedAt: new Date().toISOString(),
        },
        {
          id: `mock-grant-002`,
          title: `${request.searchThemes[1] || request.searchThemes[0] || 'Education'} Innovation Grant`,
          funder: 'Alliance for Learning',
          funderShort: 'Alliance',
          award: '$75,000',
          awardSort: 75000,
          deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          daysOut: 45,
          fit: 76,
          tags: ['Education', 'Innovation'],
          status: 'matched' as const,
          statusLabel: 'Matched',
          matchedAt: new Date().toISOString(),
        },
        {
          id: `mock-grant-003`,
          title: `${request.searchThemes[2] || request.searchThemes[0] || 'Community'} Capacity Grant`,
          funder: 'Community Innovation Network',
          funderShort: 'CIN',
          award: '$25,000',
          awardSort: 25000,
          deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          daysOut: 60,
          fit: 71,
          tags: ['Community', 'Capacity'],
          status: 'matched' as const,
          statusLabel: 'Matched',
          matchedAt: new Date().toISOString(),
        },
      ],
      evidence: [
        {
          id: 'evidence-001',
          grantId: 'mock-grant-001',
          sourceId: 'mock-source-001',
          sourceName: request.sourceName || 'Mock Source',
          evidenceType: 'eligibility' as const,
          content: `${request.searchThemes[0] || 'Technology'} alignment and community impact fit the funder priorities.`,
          capturedAt: new Date().toISOString(),
        },
      ],
      rationale: 'Mock research completed successfully across multiple aligned grants',
    };

    return {
      success: true,
      content: JSON.stringify(mockResearch),
    };
  }

  async generateDraft(request: DraftGenerationRequest): Promise<OpencodeResponse> {
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Fake provider: Opencode binary not found',
        exitCode: 1,
      };
    }

    const groundingSection = request.groundingDocuments?.length
      ? `\n\nGrounding Documents:\n${request.groundingDocuments.join('\n\n')}`
      : '';

    const mockDraft = `## ${request.grantTitle}

### Executive Summary

${request.organizationProfile} is seeking funding to support our mission of ${request.missionStatement}.${groundingSection}

### Program Description

This proposal outlines a comprehensive approach to addressing key community needs through innovative programs and partnerships.

### Organizational Qualifications

Our organization brings extensive experience in delivering impactful services to the community.

### Budget Overview

[Budget details to be added based on grant requirements]

### Conclusion

We believe this partnership will create lasting positive impact in our community.
`;

    return {
      success: true,
      content: mockDraft,
    };
  }

  async executePeerDiscovery(request: PeerDiscoveryRequest): Promise<OpencodeResponse> {
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Fake provider: Opencode binary not found',
        exitCode: 1,
      };
    }

    const mockArtifact = {
      artifactType: 'peer-discovery' as const,
      jobId: 'peer-test-id',
      timestamp: new Date().toISOString(),
      results: [
        {
          funderName: `${request.query || 'Community'} Foundation`,
          funderType: 'foundation' as const,
          relevanceRationale: `Supports community innovation hubs similar to ${request.organizationProfile}`,
          sourceOrganization: 'Peer Organization Network',
          confidence: 0.85,
        },
      ],
      organizationsAnalyzed: 1,
    };

    return {
      success: true,
      content: JSON.stringify(mockArtifact),
    };
  }

  async executeFunderInsights(request: FunderInsightsRequest): Promise<OpencodeResponse> {
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Fake provider: Opencode binary not found',
        exitCode: 1,
      };
    }

    const mockArtifact = {
      artifactType: 'funder-insights' as const,
      jobId: 'fi-test-id',
      funderId: request.funderId,
      timestamp: new Date().toISOString(),
      patterns: [
        {
          patternType: 'giving-trend' as const,
          description: 'Consistent support for STEM education initiatives',
          confidence: 'high' as const,
          suggestedAction: 'Apply for upcoming STEM grant cycle',
        },
      ],
      givingTrends: [
        {
          year: new Date().getFullYear() - 1,
          totalGiving: 5000000,
          grantsCount: 25,
          averageGrantSize: 200000,
        },
      ],
    };

    return {
      success: true,
      content: JSON.stringify(mockArtifact),
    };
  }

  async executeEligibilityVetting(request: EligibilityVettingRequest): Promise<OpencodeResponse> {
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Fake provider: Opencode binary not found',
        exitCode: 1,
      };
    }

    const mockArtifact = {
      artifactType: 'eligibility-vetting' as const,
      jobId: 'ev-test-id',
      grantId: request.grantId,
      timestamp: new Date().toISOString(),
      status: 'meets-all' as const,
      missingRequirements: [],
      recommendation: `${request.organizationProfile} meets all eligibility requirements for this grant.`,
      checks: [
        {
          requirement: 'Nonprofit status (501(c)(3))',
          met: true,
          detail: 'Organization is a registered 501(c)(3) nonprofit.',
        },
        {
          requirement: 'Geographic eligibility',
          met: true,
          detail: 'Grant is available in the service area.',
        },
        {
          requirement: 'Budget range fit',
          met: true,
          detail: 'Requested amount is within allowable range.',
        },
      ],
    };

    return {
      success: true,
      content: JSON.stringify(mockArtifact),
    };
  }

  isConfigured(): boolean {
    return !this.shouldFail;
  }
}

class CliOpencodeProvider implements OpencodeAdapter {
  private settings: OpencodeSettings;

  constructor(settings: OpencodeSettings) {
    this.settings = settings;
  }

  updateSettings(settings: OpencodeSettings): void {
    this.settings = settings;
  }

  private async runCommand(args: string[]): Promise<OpencodeResponse> {
    return new Promise((resolve) => {
      const binaryPath = this.settings.binaryPath || getCachedOpencodePath() || 'opencode';
      // Real agentic research (search + fetch the API/feed behind a SPA + verify
      // deadlines across many pages) routinely runs 2-3 minutes. Default to 300s so
      // genuine deep work is not killed mid-flight and reported as a false timeout.
      const timeoutMs = this.settings.timeoutMs || 300000;

      // Always run non-interactively: the default agent will otherwise block on a
      // tool-permission prompt forever (stdin is ignored), which manifests as a
      // silent timeout. Skipping permissions is required for headless `run`.
      const effectiveArgs =
        args[0] === 'run' && !args.includes('--dangerously-skip-permissions')
          ? ['run', '--dangerously-skip-permissions', ...args.slice(1)]
          : args;

      const proc = spawn(binaryPath, effectiveArgs, {
        cwd: this.settings.workingDirectory || process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      let timeoutHandle: NodeJS.Timeout | null = null;
      let killTimeoutHandle: NodeJS.Timeout | null = null;

      const settle = (response: OpencodeResponse): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        if (killTimeoutHandle) {
          clearTimeout(killTimeoutHandle);
          killTimeoutHandle = null;
        }
        resolve(response);
      };

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          settle({
            success: true,
            content: normalizeOpencodeOutput(stdout),
            exitCode: code ?? 0,
          });
        } else {
          const errorMessage = stderr.trim() || `Opencode exited with code ${code}`;
          const exitCode = code ?? 1;
          const failureMode = classifyOpencodeError(errorMessage, stderr, exitCode);
          const partialContent = stdout.trim() || undefined;
          settle({
            success: false,
            ...(partialContent ? { content: partialContent } : {}),
            error: errorMessage,
            exitCode: exitCode,
            failureMode,
          });
        }
      });

      proc.on('error', (err) => {
        const errorMessage = `Failed to execute Opencode: ${err.message}`;
        settle({
          success: false,
          error: errorMessage,
          exitCode: 1,
          failureMode: classifyOpencodeError(errorMessage),
        });
      });

      timeoutHandle = setTimeout(() => {
        if (!settled) {
          proc.kill('SIGTERM');
          // Set up a harder kill timeout if process doesn't respond
          killTimeoutHandle = setTimeout(() => {
            if (!settled && proc.exitCode === null) {
              proc.kill('SIGKILL');
            }
          }, 5000);
          const partialContent = stdout.trim() || undefined;
          settle({
            success: false,
            ...(partialContent ? { content: partialContent } : {}),
            error: `Opencode timed out after ${timeoutMs}ms`,
            exitCode: 124,
            failureMode: 'timeout',
          });
        }
      }, timeoutMs);
    });
  }

  async executeResearch(request: GrantResearchRequest): Promise<OpencodeResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Opencode not configured. Please set binary path and working directory in settings.',
        exitCode: 1,
      };
    }

    const existingBlock =
      request.existingGrants && request.existingGrants.length > 0
        ? request.existingGrants
            .map(
              (g) =>
                `- "${g.title}" — ${g.funder}${g.deadline ? ` (deadline ${g.deadline})` : ''}`,
            )
            .join('\n')
        : '(none yet)';

    const prompt = `You are an expert grant researcher. Inspect the funding source below and find EVERY real, currently-open grant opportunity the applicant organization could plausibly apply for. Be exhaustive: do NOT cap the number of grants — return all you can substantiate directly from the source. Never invent, pad, or return placeholder/"plausible" grants; every grant must be backed by something you actually found at the source.

== Applicant organization ==
${request.organizationProfile}

== Search themes (use these as your search terms) ==
${request.searchThemes.join(', ')}

== Funding source to crawl ==
${request.sourceName ? `Name: ${request.sourceName}` : ''}
${request.sourceUrl ? `URL: ${request.sourceUrl}` : ''}

Treat this URL as your STARTING POINT, not your only source. Many funder sites are
JavaScript single-page apps whose static HTML has NO grant data (e.g. empty
"Posted (0)" shells). Do NOT give up when that happens. Work through hard sources in
this order, and only stop when genuinely exhausted:
1. Fetch the URL. If it renders real listings, use them.
2. If the static HTML is a JS SPA / empty shell AND a headless browser tool is
   available (e.g. the Playwright MCP: browser_navigate, browser_snapshot), use it to
   render the page and read the rendered DOM. ALWAYS run the browser in HEADLESS mode.
   The Playwright MCP may not be installed on every machine — if it is unavailable,
   continue to the next step.
3. Find and query the source's machine-readable data: its public REST/JSON API, search
   endpoint, RSS/Atom feed, sitemap, or data export. Common patterns: api.<domain>,
   <domain>/api/..., /search, /opportunities, *.json. For US federal grants use the
   Grants.gov Search2 API (https://api.grants.gov/v1/api/search2) and agency APIs
   (e.g. NSF) directly.
4. Use WEB SEARCH to find this funder's currently-open grant programs, RFPs, and
   deadlines, then fetch those pages to verify the details.
5. Cross-check each grant's deadline and eligibility on the funder's own pages. Exclude
   any program that is closed, expired, or not currently accepting applications.
Return an empty grants array ONLY after you have tried the static page, a headless
browser render (if available), the API/feed, AND web search, and confirmed nothing is
currently open. Base every grant on a real page you actually loaded — never invent.

== Maximize coverage (get as much real data as possible) ==
- Enumerate EVERY distinct open opportunity, not just the first or most obvious. One
  funder often runs many concurrent programs — capture all that plausibly fit.
- Follow pagination and "load more"/next-page links until the listing is fully
  exhausted; never stop at the first page of results.
- Open individual opportunity/program detail pages to extract the real deadline, award
  range, and eligibility — list/index pages usually omit these.
- Include all relevant funding types: federal, state, and local government grants;
  private and community foundation grants; corporate giving; fellowships; prizes and
  awards; and challenge/competition funding.
- Handle rolling, recurring, and LOI-first opportunities: if there is no single fixed
  deadline, use the next cycle/inquiry date and say so in the evidence content.
- Capture forecasted/upcoming opportunities (not yet open) and mark them in the
  rationale — but exclude clearly closed or expired cycles.
- Record at least one evidence item per grant with the exact URL you read it from;
  prefer several (deadline, award_amount, eligibility, requirements) when available.
- Edge cases: de-duplicate the same program appearing on multiple pages or via multiple
  paths; if an award or deadline is genuinely unspecified, still include the grant and
  simply omit those optional fields rather than guessing; normalize award text to a
  numeric awardSort (use the upper bound of a range).
- Favor thoroughness over speed: fetching more pages and returning more verified grants
  is the goal. There is no upper limit on how many grants you may return.

== Source link & follow-up (CRITICAL) ==
- "url" MUST be the ACTUAL, full, absolute https:// link to THIS specific opportunity
  that you really loaded — the exact page the deadline/award came from. NEVER guess or
  construct a URL from a pattern, and NEVER use the funder homepage as a substitute. If
  you did not actually open a page for this grant, do not fabricate its url.
- Every grant needs a way to follow up after discovery. ALWAYS populate "contact" with
  whatever the source provides (grants/program email, phone, application portal, named
  program officer, mailing address in notes).
- If you cannot find a working direct opportunity URL, you MUST still provide "contact"
  info so the operator can follow up. A grant with neither a real url nor any contact
  info is not usable — omit it rather than guessing a link.

== Already-tracked grants (DO NOT return these again) ==
${existingBlock}
Skip any grant that duplicates one of the above (same program/funder) unless you have materially new information (e.g. a changed deadline or award).

== OUTPUT CONTRACT — STRICT ==
Return ONLY a single minified JSON object. No markdown, no code fences, no prose before or after. It MUST conform EXACTLY to this schema (omit a field only if optional and unknown):
{
  "grants": [
    {
      "id": string,            // stable slug you assign, referenced by evidence.grantId
      "title": string,         // REQUIRED
      "funder": string,        // REQUIRED
      "url": string,           // REQUIRED — direct URL to THIS grant's application/opportunity page (the exact page you read it from, not the funder homepage)
      "funderShort": string,   // short funder name
      "award": string,         // human-readable, e.g. "$50,000"
      "awardSort": number,     // numeric USD value, e.g. 50000
      "deadline": string,      // ISO date "YYYY-MM-DD"
      "daysOut": number,       // integer days until the deadline
      "fit": number,           // 0-100 fit vs the org's mission, themes, and eligibility
      "tags": string[],        // topic tags
      "contact": {             // how to follow up — REQUIRED if no working "url"
        "email": string,       // program/grants contact email
        "phone": string,       // contact phone
        "applicationUrl": string, // apply/portal link if different from "url"
        "programOfficer": string, // named contact person if listed
        "notes": string        // office hours, mailing address, or other follow-up notes
      }
    }
  ],
  "evidence": [
    {
      "id": string,
      "grantId": string,       // MUST equal the related grant's "id"
      "sourceId": string,
      "sourceName": string,    // "${request.sourceName ?? ''}"
      "evidenceType": "fit_score" | "deadline" | "award_amount" | "eligibility" | "requirements",
      "content": string,       // the supporting fact, quoted or paraphrased from the source
      "url": string,           // direct URL to the evidence
      "capturedAt": string     // ISO timestamp
    }
  ],
  "rationale": string          // brief explanation of what you selected and why
}
If you find no qualifying grants, return exactly {"grants":[],"evidence":[],"rationale":"<why none qualified>"}.
Escape all quotes so the result is valid JSON. Output NOTHING except the JSON object.${
      request.correctionHint
        ? `

== IMPORTANT: your previous reply was rejected ==
${request.correctionHint}
Return corrected output that parses as JSON and matches the schema above EXACTLY.`
        : ''
    }`;

    const args = ['run', '--format', 'json', prompt];

    return this.runCommand(args);
  }

  async generateDraft(request: DraftGenerationRequest): Promise<OpencodeResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Opencode not configured. Please set binary path and working directory in settings.',
        exitCode: 1,
      };
    }

    let prompt = `Write a concise grant proposal in Markdown for ${request.grantTitle}. Use these sections: Executive Summary, Program Design, Qualifications, Budget, Closing. Keep it under 350 words and include no preamble.

Grant: ${request.grantTitle}
Funder: ${request.grantFunder}
${request.grantAmount ? `Award Amount: ${request.grantAmount}` : ''}
${request.grantDeadline ? `Deadline: ${request.grantDeadline}` : ''}

Organization:
${request.organizationProfile}

Mission:
${request.missionStatement}
`;

    if (request.groundingDocuments?.length) {
      prompt += `\n\nGrounding documents:\n${request.groundingDocuments.join('\n\n')}`;
    }

    if (request.previousDraft) {
      prompt += `\n\nPrevious Draft:\n${request.previousDraft}`;
      prompt += `\n\nRevision Notes:\n${request.revisionNotes || 'Please improve the draft based on feedback.'}`;
    }

    const args = ['run', prompt];

    return this.runCommand(args);
  }

  async executePeerDiscovery(request: PeerDiscoveryRequest): Promise<OpencodeResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Opencode not configured. Please set binary path and working directory in settings.',
        exitCode: 1,
      };
    }

    const prompt = `Return only JSON.
Analyze peer organizations similar to the organization below and identify potential funders they have received grants from.
Return a JSON object matching the peer-discovery artifact schema with results array containing funderName, funderType, relevanceRationale, sourceOrganization, and confidence.

Organization profile:
${request.organizationProfile}
${request.query ? `\nFocus query: ${request.query}` : ''}`;

    const args = ['run', '--format', 'json', prompt];
    return this.runCommand(args);
  }

  async executeFunderInsights(request: FunderInsightsRequest): Promise<OpencodeResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Opencode not configured. Please set binary path and working directory in settings.',
        exitCode: 1,
      };
    }

    const prompt = `Return only JSON.
Analyze the funding patterns and giving trends for funder ${request.funderId}.
Return a JSON object matching the funder-insights artifact schema with patterns array and optional givingTrends array.

Organization profile:
${request.organizationProfile}`;

    const args = ['run', '--format', 'json', prompt];
    return this.runCommand(args);
  }

  async executeEligibilityVetting(request: EligibilityVettingRequest): Promise<OpencodeResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Opencode not configured. Please set binary path and working directory in settings.',
        exitCode: 1,
      };
    }

    const prompt = `Return only JSON.
Evaluate the eligibility of the organization for grant ${request.grantId}.
Return a JSON object matching the eligibility-vetting artifact schema with status, missingRequirements, recommendation, and checks array.

Organization profile:
${request.organizationProfile}
${request.requirements ? `\nGrant requirements: ${request.requirements}` : ''}`;

    const args = ['run', '--format', 'json', prompt];
    return this.runCommand(args);
  }

  isConfigured(): boolean {
    // Priority 1: Explicit binary path configured
    if (this.settings.binaryPath) return true;
    // Priority 2: Opencode auto-detected on PATH
    if (getCachedOpencodePath() !== null) return true;
    // Not configured: no usable binary path found
    return false;
  }
}

// Factory function to create the appropriate provider
// NOTE: 'fake' provider is test-only. In production, only 'cli' is allowed.
// Attempts to use 'fake' in non-test environments will throw an error.
export function createOpencodeAdapter(
  settings: OpencodeSettings,
  providerType: OpencodeProvider = 'cli',
): OpencodeAdapter {
  if (providerType === 'fake') {
    // 'fake' provider is test-only — reject in production to prevent
    // synthetic data from masquerading as real grant/research output
    const env = process.env.NODE_ENV ?? '';
    const isTestEnv = env === 'test';
    if (!isTestEnv) {
      throw new Error(
        "InvalidOperation: 'fake' opencode provider is test-only and cannot be used in " +
          `current environment (NODE_ENV=${env}). ` +
          'If opencode is not configured, the application will return explicit errors ' +
          'rather than synthetic data. Configure opencode settings or use the CLI provider.',
      );
    }
    return new FakeOpencodeProvider();
  }
  return new CliOpencodeProvider(settings);
}

// Export a singleton for use across the app
let globalAdapter: OpencodeAdapter | null = null;
let globalProviderType: OpencodeProvider = 'cli';

function _getOpencodeAdapter(
  settings?: OpencodeSettings,
  providerType?: OpencodeProvider,
): OpencodeAdapter {
  if (providerType && providerType !== globalProviderType) {
    globalProviderType = providerType;
    globalAdapter = null;
  }

  if (!globalAdapter && settings) {
    globalAdapter = createOpencodeAdapter(settings, globalProviderType);
  }

  if (!globalAdapter) {
    throw new Error('Opencode adapter requested before settings were configured');
  }

  return globalAdapter;
}

function _setOpencodeAdapter(adapter: OpencodeAdapter): void {
  globalAdapter = adapter;
}
