import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDependencies,
  resetDependencies,
  setDependencies,
} from '@/server/grant-ops/dependencies';
import {
  invalidateCache,
  withTempDataDir,
} from '../../../../../../../shared/grant-ops-persistence';
import type { Source } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { POST } from './route';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

function createSource(id: string, overrides: Partial<Source> = {}): Source {
  return {
    id,
    name: 'Test Grant Source',
    url: 'https://example.org/grants',
    type: 'website',
    createdAt: '2026-05-27T00:00:00.000Z',
    isActive: true,
    reviewStatus: 'approved',
    sourceCrawlState: 'never-crawled',
    crawlAccessCategory: 'crawlable',
    ...overrides,
  };
}

describe('/api/sources/[sourceId]/retry-crawl route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let source: Source;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(createDependencies());
    source = createSource(`source-${Date.now()}`);
    await repository.addSource(source);
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
    vi.clearAllMocks();
  });

  it('returns 404 when source is not found', async () => {
    const response = await POST(
      new Request('http://localhost/api/sources/src-missing/retry-crawl', {
        method: 'POST',
        headers: { origin: 'http://localhost' },
      }) as never,
      { params: Promise.resolve({ sourceId: 'src-missing' }) },
    );

    expect(response.status).toBe(404);
  });

  it('updates source to queued state and returns crawlRun on success', async () => {
    const response = await POST(
      new Request(`http://localhost/api/sources/${source.id}/retry-crawl`, {
        method: 'POST',
        headers: { origin: 'http://localhost' },
      }) as never,
      { params: Promise.resolve({ sourceId: source.id }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; crawlRun: { sourceId: string } };
    expect(body.success).toBe(true);
    expect(body.crawlRun.sourceId).toBe(source.id);

    const sources = await repository.getSources();
    const updated = sources.find((s) => s.id === source.id);
    expect(updated?.sourceCrawlState).toBe('queued');
  });

  it('records audit event of type source_retry_crawl on success', async () => {
    await POST(
      new Request(`http://localhost/api/sources/${source.id}/retry-crawl`, {
        method: 'POST',
        headers: { origin: 'http://localhost' },
      }) as never,
      { params: Promise.resolve({ sourceId: source.id }) },
    );

    const events = await repository.getAuditEvents();
    expect(events.some((e) => e.eventType === 'source_retry_crawl' && e.entityId === source.id)).toBe(true);
  });
});
