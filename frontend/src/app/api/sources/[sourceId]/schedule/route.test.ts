import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadCrawlSchedules, invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { Source } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { DELETE, GET, PUT } from './route';

function createSource(id: string): Source {
  return {
    id,
    name: 'Scheduled Source',
    url: 'https://example.org/scheduled-source',
    type: 'website',
    createdAt: '2026-05-27T00:00:00.000Z',
    isActive: true,
    reviewStatus: 'approved',
    sourceCrawlState: 'never-crawled',
    crawlAccessCategory: 'crawlable',
  };
}

describe('/api/sources/[sourceId]/schedule route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let source: Source;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    source = createSource(`source-${Date.now()}`);
    await repository.addSource(source);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns 404 when saving a schedule for an unknown source', async () => {
    const response = await PUT(new Request('http://localhost/api/sources/missing/schedule', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intervalHours: 6, isEnabled: true }),
    }) as never, {
      params: Promise.resolve({ sourceId: 'missing' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Source not found/i);
  });

  it('creates, reads, and deletes schedules for a source', async () => {
    const putResponse = await PUT(new Request(`http://localhost/api/sources/${source.id}/schedule`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intervalHours: 12, isEnabled: true }),
    }) as never, {
      params: Promise.resolve({ sourceId: source.id }),
    });
    const created = await putResponse.json();

    expect(putResponse.status).toBe(200);
    expect(created.sourceId).toBe(source.id);
    expect(created.intervalHours).toBe(12);

    const getResponse = await GET(new Request(`http://localhost/api/sources/${source.id}/schedule`) as never, {
      params: Promise.resolve({ sourceId: source.id }),
    });
    const fetched = await getResponse.json();
    expect(getResponse.status).toBe(200);
    expect(fetched.id).toBe(created.id);

    const schedules = await loadCrawlSchedules();
    expect(schedules).toHaveLength(1);
    expect(schedules[0]?.sourceId).toBe(source.id);

    const deleteResponse = await DELETE(new Request(`http://localhost/api/sources/${source.id}/schedule`, {
      method: 'DELETE',
    }) as never, {
      params: Promise.resolve({ sourceId: source.id }),
    });
    const deleteData = await deleteResponse.json();
    expect(deleteResponse.status).toBe(200);
    expect(deleteData.success).toBe(true);

    const getAfterDelete = await GET(new Request(`http://localhost/api/sources/${source.id}/schedule`) as never, {
      params: Promise.resolve({ sourceId: source.id }),
    });
    expect(getAfterDelete.status).toBe(404);
  });
});
