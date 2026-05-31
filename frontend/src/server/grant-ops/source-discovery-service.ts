import 'server-only';
import { execFileSync } from 'node:child_process';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { SourceDiscoverySuggestionSchema } from '../../../../shared/schemas';
import type { SourceDiscoverySuggestion } from '../../../../shared/types';
import { getDependencies, type Dependencies } from './dependencies';

export interface DiscoverSourcesResult {
  suggestions: SourceDiscoverySuggestion[];
  unavailable?: boolean;
}

const suggestionInputSchema = z.object({
  name: z.string(),
  url: z.string(),
  type: z.enum(['website', 'database', 'api']),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  id: z.string().optional(),
  createdAt: z.string().optional(),
  suggestedBy: z.literal('ai').optional(),
  suggestedCategory: z.enum(['foundation', 'government', 'corporate', 'community', 'other']).optional(),
  suggestedCrawlAccess: z.enum(['crawlable', 'manual-only', 'unsupported']).optional(),
  authMethodDescription: z.string().optional(),
  crawlFrequencyRecommendation: z.string().optional(),
});

const sourceDiscoveryPayloadSchema = z.union([
  z.array(suggestionInputSchema),
  z.object({
    suggestions: z.array(suggestionInputSchema),
  }),
]);

function parseJsonPayload(rawOutput: string): unknown {
  const trimmed = rawOutput.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const firstArray = trimmed.indexOf('[');
    const firstObject = trimmed.indexOf('{');
    const start = firstArray === -1 ? firstObject : firstObject === -1 ? firstArray : Math.min(firstArray, firstObject);
    if (start >= 0) {
      const candidate = trimmed.slice(start);
      try {
        return JSON.parse(candidate) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

type SourceDiscoverySuggestionInput = z.infer<typeof suggestionInputSchema>;

function normalizeSuggestion(
  item: SourceDiscoverySuggestionInput,
  deps: Dependencies,
): SourceDiscoverySuggestion | null {
  const suggestionInput: Record<string, unknown> = {
    id: item.id ?? deps.idGenerator.generateId('suggestion'),
    name: item.name,
    url: item.url,
    type: item.type,
    rationale: item.rationale,
    confidence: item.confidence,
    suggestedBy: item.suggestedBy ?? 'ai',
    createdAt: item.createdAt ?? new Date().toISOString(),
  };
  if (item.suggestedCategory) suggestionInput['suggestedCategory'] = item.suggestedCategory;
  if (item.suggestedCrawlAccess) suggestionInput['suggestedCrawlAccess'] = item.suggestedCrawlAccess;
  if (item.authMethodDescription) suggestionInput['authMethodDescription'] = item.authMethodDescription;
  if (item.crawlFrequencyRecommendation) suggestionInput['crawlFrequencyRecommendation'] = item.crawlFrequencyRecommendation;
  const parsed = SourceDiscoverySuggestionSchema.safeParse(suggestionInput);

  return parsed.success ? parsed.data as SourceDiscoverySuggestion : null;
}

function buildPrompt(prompt: string): string {
  return [
    'Return only JSON.',
    'You are helping a nonprofit research team identify real grant source destinations from an operator prompt.',
    'Return a JSON array only; no markdown, no prose, no explanation.',
    'Each item must contain:',
    '  - name: source name',
    '  - url: real, verifiable URL (no synthetic URLs)',
    '  - type: "website" | "database" | "api"',
    '  - rationale: why this source is relevant to the prompt',
    '  - confidence: 0.0-1.0 how certain you are this is a real, useful source',
    '  - suggestedCategory: "foundation" | "government" | "corporate" | "community" | "other"',
    '  - suggestedCrawlAccess: "crawlable" (public pages, no login) | "manual-only" (requires browser interaction) | "unsupported" (paywalled, captcha, etc.)',
    '  - authMethodDescription: brief note on auth needed (e.g. "none", "API key", "OAuth2")',
    '  - crawlFrequencyRecommendation: "daily" | "weekly" | "monthly" based on how often content changes',
    'Prefer evidence-backed sources and avoid synthetic URLs.',
    '',
    `Operator request: ${prompt}`,
  ].join('\n');
}

export async function discoverSourcesFromPrompt(
  prompt: string,
  deps: Dependencies = getDependencies(),
): Promise<DiscoverSourcesResult> {
  const settings = await deps.repository.getOpencodeSettings();

  // Resolve binary path: configured path first, then PATH detection fallback
  let binaryPath = settings?.binaryPath?.trim() || '';
  if (!binaryPath) {
    try {
      const isWindows = process.platform === 'win32';
      const locateCmd = isWindows ? 'where' : 'which';
      const output = execFileSync(locateCmd, ['opencode'], {
        encoding: 'utf8',
        timeout: 5000,
      });
      const firstLine = output.trim().split(/\r?\n/)[0]?.trim();
      if (firstLine && firstLine.length > 0) {
        binaryPath = firstLine;
      }
    } catch {
      // opencode not on PATH
    }
  }

  if (!binaryPath) {
    return { suggestions: [], unavailable: true };
  }

  try {
    const output = execFileSync(binaryPath, ['run', '--format', 'json', buildPrompt(prompt)], {
      cwd: settings?.workingDirectory || process.cwd(),
      timeout: settings?.timeoutMs || 60000,
      encoding: 'utf8',
    });

    const parsedPayload = parseJsonPayload(String(output));
    const validated = sourceDiscoveryPayloadSchema.safeParse(parsedPayload);
    if (!validated.success) {
      logger.error({ err: validated.error.flatten() }, 'Error parsing source discovery output');
      return { suggestions: [] };
    }

    const rawSuggestions = Array.isArray(validated.data) ? validated.data : validated.data.suggestions;
    const suggestions = rawSuggestions
      .map((item) => normalizeSuggestion(item, deps))
      .filter((item): item is SourceDiscoverySuggestion => item !== null)
      .map((item) => ({
        ...item,
        id: item.id || deps.idGenerator.generateId('suggestion'),
        createdAt: item.createdAt || new Date().toISOString(),
        suggestedBy: 'ai' as const,
      }));

    return { suggestions };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while discovering sources';
    if (/not configured|binary not found|enoent|no such file/i.test(message)) {
      return { suggestions: [], unavailable: true };
    }
    logger.error({ err: message }, 'Error discovering sources');
    return { suggestions: [] };
  }
}
