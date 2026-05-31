import { logger } from '@/lib/logger';

/**
 * ProPublica Research Service
 *
 * Fetches grant opportunities from ProPublica Nonprofit Explorer via the
 * opencode adapter. ProPublica is a hardcoded research source that provides
 * real nonprofit funding data without requiring a separate API key.
 *
 * ## Expected Response Shape
 *
 * The opencode prompt requests a strict JSON array matching the Grant schema
 * from shared/types.ts. Each grant must include:
 *   - id: string
 *   - title: string
 *   - funder: string
 *   - funderShort: string
 *   - award: string (e.g. "$50,000")
 *   - awardSort: number
 *   - deadline: string (ISO date or "Rolling")
 *   - daysOut: number
 *   - fit: number (0-100)
 *   - tags: string[]
 *   - status: GrantStatus (default: "matched")
 *   - statusLabel: string (default: "Matched")
 *
 * ## Error Handling
 *
 * - If opencode is not configured, returns { grants: [], unavailable: true }
 * - If opencode produces malformed output, returns { grants: [] }
 * - If opencode fails entirely, returns { grants: [], error: message }
 * - The service never crashes — all errors are caught and returned gracefully
 */

import 'server-only';
import { execFileSync } from 'node:child_process';
import type { Grant } from '../../../../shared/types';
import { getDependencies, type Dependencies } from './dependencies';

export interface ProPublicaResult {
  grants: Grant[];
  unavailable?: boolean;
  error?: string;
}

const PROPUBLICA_SOURCE_URL = 'https://projects.propublica.org/nonprofits/';
const PROPUBLICA_SOURCE_NAME = 'ProPublica Nonprofit Explorer';

function buildProPublicaPrompt(query: string): string {
  return [
    'Return only valid JSON. No markdown, no prose, no explanation.',
    '',
    'You are searching ProPublica Nonprofit Explorer for real grant opportunities.',
    'ProPublica Nonprofit Explorer (https://projects.propublica.org/nonprofits/) is a public database',
    'of nonprofit tax filings (Form 990) that includes grant amounts, funders, and recipients.',
    '',
    'Based on the search query below, identify 1-5 real grant opportunities that are verifiable',
    'through ProPublica data. Each grant must include ALL of the following fields as a JSON array:',
    '',
    '  - id: unique string identifier',
    '  - title: descriptive grant/program name',
    '  - funder: name of the funding organization',
    '  - funderShort: abbreviated funder name',
    '  - award: award amount as string (e.g. "$50,000" or "Unknown")',
    '  - awardSort: numeric award amount for sorting (0 if unknown)',
    '  - deadline: ISO date string (YYYY-MM-DD) or "Rolling" if no fixed deadline',
    '  - daysOut: estimated days until deadline (365 if Rolling)',
    '  - fit: numeric fit score 0-100 based on query relevance',
    '  - tags: array of relevant keyword strings',
    '  - status: "matched"',
    '  - statusLabel: "Matched"',
    '  - matchedAt: current ISO timestamp',
    '  - externalUrl: "https://projects.propublica.org/nonprofits/"',
    '  - funderSummary: brief description of the funder',
    '',
    'If you cannot find any real grants matching the query, return an empty array: []',
    '',
    `Search query: ${query}`,
  ].join('\n');
}

function parseProPublicaOutput(rawOutput: string): Grant[] {
  const trimmed = rawOutput.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is Grant =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.title === 'string' &&
          typeof item.funder === 'string',
      );
    }
    // Some models wrap in an object
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.grants)) {
      return parsed.grants.filter(
        (item: unknown): item is Grant =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Grant).title === 'string',
      );
    }
    return [];
  } catch {
    // Try to extract JSON from markdown or mixed output
    const firstBracket = trimmed.indexOf('[');
    if (firstBracket >= 0) {
      try {
        const candidate = trimmed.slice(firstBracket);
        // Find matching closing bracket
        let depth = 0;
        let endIndex = -1;
        for (let i = 0; i < candidate.length; i++) {
          if (candidate[i] === '[') depth++;
          if (candidate[i] === ']') {
            depth--;
            if (depth === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
        if (endIndex > 0) {
          const jsonStr = candidate.slice(0, endIndex);
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            return parsed.filter(
              (item): item is Grant =>
                typeof item === 'object' &&
                item !== null &&
                typeof item.title === 'string',
            );
          }
        }
      } catch {
        // Extraction failed
      }
    }
    return [];
  }
}

export async function fetchProPublicaGrants(
  query: string,
  deps: Dependencies = getDependencies(),
): Promise<ProPublicaResult> {
  const settings = await deps.repository.getOpencodeSettings();
  if (!settings?.isConfigured || !settings.binaryPath?.trim()) {
    // Try PATH fallback (same as health-service resolveOpencodePath)
    const { execFileSync: whichExec } = await import('node:child_process');
    let binaryPath: string | null = null;
    try {
      const isWindows = process.platform === 'win32';
      const output = whichExec(isWindows ? 'where' : 'which', ['opencode'], {
        encoding: 'utf8',
        timeout: 5000,
      });
      const firstLine = output.trim().split(/\r?\n/)[0]?.trim();
      if (firstLine && firstLine.length > 0) {
        binaryPath = firstLine;
      }
    } catch {
      // Not on PATH either
    }

    if (!binaryPath) {
      return { grants: [], unavailable: true };
    }

    // Use PATH-found binary
    try {
      const output = execFileSync(binaryPath, ['run', '--format', 'json', buildProPublicaPrompt(query)], {
        cwd: settings?.workingDirectory || process.cwd(),
        timeout: settings?.timeoutMs || 60000,
        encoding: 'utf8',
      });

      const grants = parseProPublicaOutput(String(output));
      return { grants };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (/not configured|binary not found|enoent|no such file/i.test(message)) {
        return { grants: [], unavailable: true };
      }
      logger.error({ err: message }, 'Error fetching ProPublica grants');
      return { grants: [], error: message };
    }
  }

  try {
    const output = execFileSync(settings.binaryPath, ['run', '--format', 'json', buildProPublicaPrompt(query)], {
      cwd: settings.workingDirectory || process.cwd(),
      timeout: settings.timeoutMs || 60000,
      encoding: 'utf8',
    });

    const grants = parseProPublicaOutput(String(output));
    return { grants };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while fetching ProPublica grants';
    if (/not configured|binary not found|enoent|no such file/i.test(message)) {
      return { grants: [], unavailable: true };
    }
    logger.error({ err: message }, 'Error fetching ProPublica grants');
    return { grants: [], error: message };
  }
}

/**
 * Register ProPublica as a persistent source record.
 * This should be called once during setup or lazily on first ProPublica search.
 * Idempotent — if the source already exists, it is not duplicated.
 */
export async function ensureProPublicaSourceRegistered(
  deps: Dependencies = getDependencies(),
): Promise<void> {
  const existingSources = await deps.repository.getSources();
  const alreadyRegistered = existingSources.some(
    (s) => s.name === PROPUBLICA_SOURCE_NAME,
  );

  if (alreadyRegistered) {
    return;
  }

  const source = {
    id: deps.idGenerator.generateId('source'),
    name: PROPUBLICA_SOURCE_NAME,
    url: PROPUBLICA_SOURCE_URL,
    type: 'api' as const,
    createdAt: deps.clock.now().toISOString(),
    isActive: true,
    reviewStatus: 'approved' as const,
    sourceCrawlState: 'never-crawled' as const,
    crawlAccessCategory: 'crawlable' as const,
    category: 'other' as const,
    suggestedBy: 'system',
    suggestionReason: 'Hardcoded research source for ProPublica Nonprofit Explorer grant data',
  };

  await deps.repository.addSource(source);
}
