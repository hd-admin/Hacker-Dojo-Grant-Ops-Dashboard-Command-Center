import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import * as repository from '../../../server/grant-ops/repository';
import { DELETE, GET, POST } from './route';

function makeRequest(body: unknown, method = 'POST') {
  return new Request('http://localhost/api/sources', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/sources route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('rejects invalid source input with 400', async () => {
    const response = await POST(makeRequest({ name: 'Missing URL' }) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Name and URL are required/i);
  });

  it('creates, persists, and returns a source', async () => {
    const response = await POST(
      makeRequest({ name: 'Candid', url: 'https://www.candid.org', type: 'website' }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.source.name).toBe('Candid');
    // New sources default to pending-review (not crawl-active until explicitly approved)
    expect(data.source.reviewStatus).toBe('pending-review');
    expect(data.source.isActive).toBe(false);

    const sources = await repository.getSources();
    expect(sources).toHaveLength(1);
    expect(sources[0]?.url).toBe('https://www.candid.org');
  });

  it('creates an approved source when reviewStatus is explicitly approved', async () => {
    const response = await POST(
      makeRequest({ name: 'Candid', url: 'https://www.candid.org', type: 'website', reviewStatus: 'approved' }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.source.name).toBe('Candid');
    expect(data.source.reviewStatus).toBe('approved');
    expect(data.source.isActive).toBe(true);

    const sources = await repository.getSources();
    expect(sources).toHaveLength(1);
    expect(sources[0]?.url).toBe('https://www.candid.org');
  });

  it('GET returns persisted sources and DELETE removes them', async () => {
    const createResponse = await POST(
      makeRequest({ name: 'GrantWatch', url: 'https://grantwatch.example', type: 'database' }) as never,
    );
    const createData = await createResponse.json();
    const sourceId = createData.source.id as string;

    const getResponse = await GET(new Request('http://localhost/api/sources') as never);
    const sources = await getResponse.json();
    expect(getResponse.status).toBe(200);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.id).toBe(sourceId);

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/sources?id=${encodeURIComponent(sourceId)}`, { method: 'DELETE' }) as never,
    );
    const deleteData = await deleteResponse.json();
    expect(deleteResponse.status).toBe(200);
    expect(deleteData.success).toBe(true);

    const afterDelete = await repository.getSources();
    expect(afterDelete).toHaveLength(0);
  });

  it('rejects missing source id on delete', async () => {
    const response = await DELETE(new Request('http://localhost/api/sources', { method: 'DELETE' }) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Source ID is required/i);
  });
});
