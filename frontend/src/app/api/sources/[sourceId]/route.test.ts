/**
 * Source Detail API Route Tests
 *
 * Tests the /api/sources/[sourceId] PUT route for updating sources.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDependencies,
  resetDependencies,
  setDependencies,
} from '@/server/grant-ops/dependencies';
import {
  invalidateCache,
  withTempDataDir,
} from '../../../../../../shared/grant-ops-persistence';
import type { Source } from '../../../../../../shared/types';
import * as repository from '../../../../server/grant-ops/repository';
import { PUT } from './route';

function createSource(id: string, overrides: Partial<Source> = {}): Source {
  return {
    id,
    name: 'Candid Foundation Database',
    url: 'https://www.candid.org',
    type: 'website',
    createdAt: '2026-05-27T00:00:00.000Z',
    isActive: true,
    reviewStatus: 'approved',
    suggestedBy: 'ai',
    category: 'foundation',
    sourceCrawlState: 'never-crawled',
    crawlAccessCategory: 'crawlable',
    ...overrides,
  };
}

function makeUpdateRequest(sourceId: string, body: unknown) {
  return new Request(`http://localhost/api/sources/${sourceId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/sources/[sourceId] route', () => {
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
  });

  it('updates source name', async () => {
    const response = await PUT(
      makeUpdateRequest(source.id, { name: 'Updated Name' }) as never,
      { params: Promise.resolve({ sourceId: source.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('Updated Name');
    expect(data.url).toBe(source.url);

    // Verify persistence
    const sources = await repository.getSources();
    const updated = sources.find((s) => s.id === source.id);
    expect(updated?.name).toBe('Updated Name');
  });

  it('updates source URL', async () => {
    const response = await PUT(
      makeUpdateRequest(source.id, { url: 'https://updated.example.com' }) as never,
      { params: Promise.resolve({ sourceId: source.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toBe('https://updated.example.com');
    expect(data.name).toBe(source.name);
  });

  it('updates source type', async () => {
    const response = await PUT(
      makeUpdateRequest(source.id, { type: 'database' }) as never,
      { params: Promise.resolve({ sourceId: source.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.type).toBe('database');
  });

  it('updates source category', async () => {
    const response = await PUT(
      makeUpdateRequest(source.id, {
        category: 'government',
        categoryRationale: 'Government funding source',
      }) as never,
      { params: Promise.resolve({ sourceId: source.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.category).toBe('government');
    expect(data.categoryRationale).toBe('Government funding source');
  });

  it('records an audit event on update', async () => {
    const response = await PUT(
      makeUpdateRequest(source.id, { name: 'Audited Name', url: 'https://audited.example' }) as never,
      { params: Promise.resolve({ sourceId: source.id }) },
    );

    expect(response.status).toBe(200);

    const events = await repository.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('source_edited');
    expect(events[0]?.entityId).toBe(source.id);
  });

  it('returns 404 for non-existent source', async () => {
    const response = await PUT(
      makeUpdateRequest('non-existent', { name: 'Ghost' }) as never,
      { params: Promise.resolve({ sourceId: 'non-existent' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Source not found/i);
  });

  it('rejects invalid update payload with 400', async () => {
    const response = await PUT(
      makeUpdateRequest(source.id, { type: 'invalid-type' }) as never,
      { params: Promise.resolve({ sourceId: source.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid source update payload/i);
  });

  it('rejects malformed JSON body', async () => {
    const response = await PUT(
      new Request(`http://localhost/api/sources/${source.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }) as never,
      { params: Promise.resolve({ sourceId: source.id }) },
    );
    const { status } = response;

    expect(status).toBe(400);
  });
});
