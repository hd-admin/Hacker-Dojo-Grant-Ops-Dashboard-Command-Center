import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../shared/grant-ops-persistence';
import { POST, GET } from './route';

describe('/api/crawl/scheduled route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('reports zero triggered jobs when queried without trigger=true', async () => {
    const response = await GET(new Request('http://localhost/api/crawl/scheduled') as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ triggered: 0 });
  });

  it('returns the triggered count from the scheduler service on POST', async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ triggered: 0 });
  });
});
