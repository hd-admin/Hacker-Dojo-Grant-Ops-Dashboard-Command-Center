/**
 * Testing Reset API Route Tests
 *
 * Tests the /api/testing/reset POST route for resetting persistent state.
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
import type { Grant } from '../../../../../../shared/types';
import * as repository from '../../../../server/grant-ops/repository';
import { POST } from './route';

function createGrant(id: string): Grant {
  return {
    id,
    title: `Test Grant ${id}`,
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$50,000',
    awardSort: 50000,
    deadline: '2026-12-31',
    daysOut: 200,
    fit: 80,
    tags: ['Test'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-01-01',
  };
}

describe('/api/testing/reset route', () => {
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

  it('resets persistent state to seed data', async () => {
    // Add some custom data first
    await repository.addGrant(createGrant('grant-custom'));
    await repository.addAuditEvent({
      id: 'audit-reset-1',
      eventType: 'test_event',
      entityId: 'grant-custom',
      entityType: 'grant',
      actorLabel: 'test',
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    // Verify data exists before reset
    const grantsBefore = await repository.getGrants();
    expect(grantsBefore.length).toBeGreaterThan(0);

    // Perform reset
    const response = await POST(
      new Request('http://localhost/api/testing/reset', { method: 'POST' }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify state was reset (grants are cleared on reset)
    const grantsAfter = await repository.getGrants();
    expect(grantsAfter.length).toBe(0);
  });

  it('can be called multiple times', async () => {
    const response1 = await POST(
      new Request('http://localhost/api/testing/reset', { method: 'POST' }) as never,
    );
    expect(response1.status).toBe(200);
    expect((await response1.json()).success).toBe(true);

    const response2 = await POST(
      new Request('http://localhost/api/testing/reset', { method: 'POST' }) as never,
    );
    expect(response2.status).toBe(200);
    expect((await response2.json()).success).toBe(true);
  });

  it('clears audit events on reset', async () => {
    await repository.addAuditEvent({
      id: 'audit-clear-1',
      eventType: 'test_event',
      entityId: 'test',
      entityType: 'test',
      actorLabel: 'test',
      timestamp: new Date().toISOString(),
      metadata: {},
    });

    const eventsBefore = await repository.getAuditEvents();
    expect(eventsBefore.length).toBeGreaterThan(0);

    const response = await POST(
      new Request('http://localhost/api/testing/reset', { method: 'POST' }) as never,
    );
    expect(response.status).toBe(200);

    const eventsAfter = await repository.getAuditEvents();
    expect(eventsAfter.length).toBe(0);
  });

  it('clears jobs on reset', async () => {
    await repository.addJobQueueItem({
      id: 'job-reset-1',
      jobType: 'research',
      status: 'queued',
      stage: 'pending',
      lastUpdate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      entityId: 'grant-1',
      retryCount: 0,
    });

    const jobsBefore = await repository.getJobQueue();
    expect(jobsBefore.length).toBeGreaterThan(0);

    const response = await POST(
      new Request('http://localhost/api/testing/reset', { method: 'POST' }) as never,
    );
    expect(response.status).toBe(200);

    const jobsAfter = await repository.getJobQueue();
    expect(jobsAfter.length).toBe(0);
  });
});
