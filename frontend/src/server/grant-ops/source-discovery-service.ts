import type { SourceDiscoverySuggestion } from '../../../../shared/types';
import { getDependencies } from './dependencies';

export interface DiscoverSourcesResult {
  suggestions: SourceDiscoverySuggestion[];
  unavailable?: boolean;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'grant-source';
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const DISCOVERY_STOP_WORDS = new Set(['find', 'show', 'discover', 'grant', 'grants', 'source', 'sources']);

export async function discoverSourcesFromPrompt(prompt: string): Promise<DiscoverSourcesResult> {
  const deps = getDependencies();
  const settings = await deps.repository.getOpencodeSettings();

  if (!settings?.isConfigured) {
    return { suggestions: [], unavailable: true };
  }

  const words = prompt
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3)
    .filter((word) => !DISCOVERY_STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 3);

  const subjects = words.length > 0 ? words : ['community', 'education', 'innovation'];
  const now = new Date().toISOString();

  const suggestions: SourceDiscoverySuggestion[] = subjects.map((subject, index) => ({
    id: `discover-${slugify(subject)}-${index + 1}`,
    name: `${titleCase(subject)} Grants`,
    url: `https://${slugify(subject)}.example.org`,
    type: 'website',
    rationale: `Likely relevant to the prompt because it focuses on ${subject}.`,
    confidence: Math.max(0.55, 0.92 - index * 0.12),
    suggestedBy: 'ai',
    createdAt: now,
  }));

  return { suggestions };
}
