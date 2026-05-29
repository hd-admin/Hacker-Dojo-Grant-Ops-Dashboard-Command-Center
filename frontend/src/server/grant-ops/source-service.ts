/**
 * Source Service
 *
 * Manages grant source CRUD operations and source-related business logic.
 *
 * This service uses the DI boundary from dependencies.ts for all external dependencies.
 */

import type { CrawlRun, Source, SourceCrawlState } from '../../../../shared/types';
import { getDependencies } from './dependencies';

export interface AddSourceInput {
  name: string;
  url: string;
  type: 'website' | 'database' | 'api';
  reviewStatus?: Source['reviewStatus'];
  suggestedBy?: string;
  suggestionReason?: string;
  category?: Source['category'];
  categoryRationale?: string;
  crawlAccessCategory?: Source['crawlAccessCategory'];
}

export interface SourceService {
  getAllSources(): Promise<Source[]>;
  addSource(input: AddSourceInput): Promise<Source>;
  removeSource(id: string): Promise<boolean>;
  activateSource(id: string): Promise<boolean>;
  deactivateSource(id: string): Promise<boolean>;
  getActiveSources(): Promise<Source[]>;
}

export async function getAllSources(): Promise<Source[]> {
  const deps = getDependencies();
  return deps.repository.getSources();
}

export async function addSource(input: AddSourceInput): Promise<Source> {
  const deps = getDependencies();
  const clock = deps.clock;
  const idGenerator = deps.idGenerator;

  const source: Source = {
    id: idGenerator.generateId('source'),
    name: input.name,
    url: input.url,
    type: input.type,
    createdAt: clock.now().toISOString(),
    isActive: input.reviewStatus === 'approved',
    reviewStatus: input.reviewStatus ?? 'pending-review',
    sourceCrawlState: 'never-crawled',
    crawlAccessCategory: input.crawlAccessCategory ?? 'crawlable',
  };
  if (input.suggestedBy !== undefined) source.suggestedBy = input.suggestedBy;
  if (input.suggestionReason !== undefined) source.suggestionReason = input.suggestionReason;
  if (input.category !== undefined) source.category = input.category;
  if (input.categoryRationale !== undefined) source.categoryRationale = input.categoryRationale;

  const persistedSource = {
    ...source,
    isActive: source.reviewStatus === 'approved',
  };

  await deps.repository.addSource(persistedSource);
  return persistedSource;
}

export async function removeSource(id: string): Promise<boolean> {
  const deps = getDependencies();
  await deps.repository.removeSource(id);
  return true;
}

export async function activateSource(id: string): Promise<boolean> {
  const deps = getDependencies();
  const sources = await deps.repository.getSources();
  const source = sources.find((s) => s.id === id);
  if (!source) {
    return false;
  }

  source.isActive = true;
  await deps.repository.removeSource(id);
  await deps.repository.addSource(source);
  return true;
}

export async function deactivateSource(id: string): Promise<boolean> {
  const deps = getDependencies();
  const sources = await deps.repository.getSources();
  const source = sources.find((s) => s.id === id);
  if (!source) {
    return false;
  }

  source.isActive = false;
  await deps.repository.removeSource(id);
  await deps.repository.addSource(source);
  return true;
}

export async function getActiveSources(): Promise<Source[]> {
  const deps = getDependencies();
  const sources = await deps.repository.getSources();
  return sources.filter((s) => s.isActive && (s.reviewStatus === undefined || s.reviewStatus === 'approved'));
}

export async function updateSourceLastCrawled(id: string): Promise<boolean> {
  const deps = getDependencies();
  const clock = deps.clock;
  const sources = await deps.repository.getSources();
  const source = sources.find((s) => s.id === id);
  if (!source) {
    return false;
  }

  source.lastCrawledAt = clock.now().toISOString();
  await deps.repository.removeSource(id);
  await deps.repository.addSource(source);
  return true;
}

/**
 * Compute the crawl state for a source based on its crawl run history.
 */
export async function computeSourceCrawlState(sourceId: string): Promise<SourceCrawlState> {
  const deps = getDependencies();
  const runs = await getSourceCrawlHistory(sourceId);

  if (runs.length === 0) {
    return 'never-crawled';
  }

  // Check for active runs
  const activeRun = runs.find((r) => r.status === 'running');
  if (activeRun) {
    return 'running';
  }

  // Check for queued runs (status queued isn't in CrawlRun, but we handle it)
  const queuedRun = runs.find((r) => (r as CrawlRun & { status: string }).status === 'queued');
  if (queuedRun) {
    return 'queued';
  }

  // Sort by recency
  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const latestRun = sortedRuns[0];

  if (!latestRun) {
    return 'never-crawled';
  }

  if (latestRun.status === 'completed') {
    // Check if there were partial failures in recent history
    const recentFailures = sortedRuns.slice(0, 3).filter((r) => r.status === 'failed');
    if (recentFailures.length > 0) {
      return 'partially-failed';
    }
    return 'succeeded';
  }

  if (latestRun.status === 'failed') {
    return 'failed';
  }

  return 'never-crawled';
}

/**
 * Get crawl run history for a specific source.
 */
export async function getSourceCrawlHistory(sourceId: string): Promise<CrawlRun[]> {
  const deps = getDependencies();
  const allRuns = await deps.repository.getCrawlRuns();
  return allRuns
    .filter((run) => run.sourceId === sourceId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

/**
 * Enrich a single source with its computed crawl state.
 */
export async function enrichSourceWithCrawlState(source: Source): Promise<Source> {
  const crawlState = await computeSourceCrawlState(source.id);
  const runs = await getSourceCrawlHistory(source.id);

  const latestFailed = runs.find((r) => r.status === 'failed');
  const latestSucceeded = runs.find((r) => r.status === 'completed');

  return {
    ...source,
    sourceCrawlState: crawlState,
    lastFailedAt: latestFailed?.completedAt || latestFailed?.startedAt,
    failureCategory: latestFailed?.failureCategory,
    lastCrawledAt: source.lastCrawledAt ?? latestSucceeded?.completedAt,
  };
}
