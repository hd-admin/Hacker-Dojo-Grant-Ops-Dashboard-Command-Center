/**
 * Audit API Route Tests
 *
 * Tests the /api/audit GET route with optional entityId/entityType filters.
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
} from '../../../../../shared/grant-ops-persistence';
import * as repository from '../../../server/grant-ops/repository';
import { GET } from './route';

describe('/api/audit route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(createDependencies());
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns empty array when no audit events exist', async () => {
    const response = await GET(
      new Request('http://localhost/api/audit') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it('returns audit events sorted by timestamp descending', async () => {
    await repository.addAuditEvent({
      id: 'audit-1',
      eventType: 'grant_created',
      entityId: 'grant-1',
      entityType: 'grant',
      actorLabel: 'system',
      timestamp: '2026-01-01T00:00:00.000Z',
      metadata: {},
    });
    await repository.addAuditEvent({
      id: 'audit-2',
      eventType: 'grant_modified',
      entityId: 'grant-1',
      entityType: 'grant',
      actorLabel: 'operator',
      timestamp: '2026-06-01T00:00:00.000Z',
      metadata: {},
    });

    const response = await GET(
      new Request('http://localhost/api/audit') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    // Most recent first
    expect(data[0].eventType).toBe('grant_modified');
    expect(data[1].eventType).toBe('grant_created');
  });

  it('filters by entityId query parameter', async () => {
    await repository.addAuditEvent({
      id: 'audit-1',
      eventType: 'grant_created',
      entityId: 'grant-1',
      entityType: 'grant',
      actorLabel: 'system',
      timestamp: new Date().toISOString(),
      metadata: {},
    });
    await repository.addAuditEvent({
      id: 'audit-2',
      eventType: 'source_added',
      entityId: 'source-1',
      entityType: 'source',
      actorLabel: 'operator',
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    const response = await GET(
      new Request('http://localhost/api/audit?entityId=grant-1') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].entityId).toBe('grant-1');
  });

  it('filters by entityType query parameter', async () => {
    await repository.addAuditEvent({
      id: 'audit-1',
      eventType: 'grant_created',
      entityId: 'grant-1',
      entityType: 'grant',
      actorLabel: 'system',
      timestamp: new Date().toISOString(),
      metadata: {},
    });
    await repository.addAuditEvent({
      id: 'audit-2',
      eventType: 'source_added',
      entityId: 'source-1',
      entityType: 'source',
      actorLabel: 'operator',
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    const response = await GET(
      new Request('http://localhost/api/audit?entityType=source') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].entityType).toBe('source');
  });

  it('filters by both entityId and entityType', async () => {
    await repository.addAuditEvent({
      id: 'audit-1',
      eventType: 'grant_created',
      entityId: 'grant-1',
      entityType: 'grant',
      actorLabel: 'system',
      timestamp: new Date().toISOString(),
      metadata: {},
    });
    await repository.addAuditEvent({
      id: 'audit-2',
      eventType: 'source_added',
      entityId: 'source-1',
      entityType: 'source',
      actorLabel: 'operator',
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    const response = await GET(
      new Request('http://localhost/api/audit?entityId=source-1&entityType=source') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].entityId).toBe('source-1');
    expect(data[0].entityType).toBe('source');
  });
});
