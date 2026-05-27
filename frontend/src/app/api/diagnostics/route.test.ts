import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import type { AuditEvent, JobQueueItem } from '../../../../../shared/types';
import * as repository from '../../../server/grant-ops/repository';
import { GET } from './route';

function createAuditEvent(id: string, eventType: string): AuditEvent {
  return {
    id,
    eventType,
    entityId: 'grant-1',
    entityType: 'grant',
    actorLabel: 'system',
    timestamp: '2026-05-27T00:00:00.000Z',
    metadata: { source: 'test' },
  };
}

function createJob(id: string, status: JobQueueItem['status']): JobQueueItem {
  return {
    id,
    jobType: 'draft',
    status,
    stage: status === 'failed' ? 'render' : 'prepare',
    lastUpdate: '2026-05-27T00:00:00.000Z',
    createdAt: '2026-05-27T00:00:00.000Z',
    entityId: 'grant-1',
    errorMessage: status === 'failed' ? 'render failed' : undefined,
    failureCategory: status === 'failed' ? 'logic' : undefined,
  };
}

describe('/api/diagnostics route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    await repository.addAuditEvent(createAuditEvent('audit-failed', 'research_failed'));
    await repository.addAuditEvent(createAuditEvent('audit-ok', 'grant_matched'));
    await repository.addJobQueueItem(createJob('job-running', 'running'));
    await repository.addJobQueueItem(createJob('job-failed', 'failed'));
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns health, recent errors, and job diagnostics', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.health.storage).toBe('ok');
    expect(data.health.documentIndexer).toBe('degraded');
    expect(Array.isArray(data.recentErrors)).toBe(true);
    expect(data.recentErrors[0]?.eventType).toBe('research_failed');
    expect(data.activeJobs).toHaveLength(1);
    expect(data.activeJobs[0]?.id).toBe('job-running');
    expect(data.failedJobs).toHaveLength(1);
    expect(data.failedJobs[0]?.id).toBe('job-failed');
    expect(data.systemInfo.nodeVersion).toBe(process.version);
    expect(data.generatedAt).toBeTruthy();
  });
});
