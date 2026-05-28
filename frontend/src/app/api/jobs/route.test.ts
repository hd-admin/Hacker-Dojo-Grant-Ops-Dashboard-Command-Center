/**
 * Jobs API Route Tests
 *
 * Tests the /api/jobs GET route for listing job queue items with optional status filter.
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
import type { JobQueueItem } from '../../../../../shared/types';
import * as repository from '../../../server/grant-ops/repository';
import { GET } from './route';

function createJob(id: string, status: JobQueueItem['status']): JobQueueItem {
  return {
    id,
    jobType: 'research',
    status,
    stage: status === 'completed' ? 'completed' : 'running-fetch',
    lastUpdate: '2026-05-27T00:00:00.000Z',
    createdAt: '2026-05-27T00:00:00.000Z',
    entityId: 'grant-1',
    retryCount: 0,
  };
}

describe('/api/jobs route', () => {
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

  it('returns empty array when no jobs exist', async () => {
    const response = await GET(
      new Request('http://localhost/api/jobs') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  it('returns all jobs when no status filter is provided', async () => {
    await repository.addJobQueueItem(createJob('job-1', 'queued'));
    await repository.addJobQueueItem(createJob('job-2', 'running'));
    await repository.addJobQueueItem(createJob('job-3', 'completed'));

    const response = await GET(
      new Request('http://localhost/api/jobs') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(3);
  });

  it('filters jobs by status query parameter', async () => {
    await repository.addJobQueueItem(createJob('job-1', 'queued'));
    await repository.addJobQueueItem(createJob('job-2', 'running'));
    await repository.addJobQueueItem(createJob('job-3', 'completed'));

    const response = await GET(
      new Request('http://localhost/api/jobs?status=queued') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('job-1');
    expect(data[0].status).toBe('queued');
  });

  it('filters by failed status', async () => {
    await repository.addJobQueueItem(createJob('job-1', 'completed'));
    await repository.addJobQueueItem(createJob('job-2', 'failed'));
    await repository.addJobQueueItem(createJob('job-3', 'failed'));

    const response = await GET(
      new Request('http://localhost/api/jobs?status=failed') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    const ids = data.map((j: JobQueueItem) => j.id);
    expect(ids).toContain('job-2');
    expect(ids).toContain('job-3');
  });

  it('returns each job with required fields', async () => {
    await repository.addJobQueueItem(createJob('job-1', 'queued'));

    const response = await GET(
      new Request('http://localhost/api/jobs') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0]).toHaveProperty('id');
    expect(data[0]).toHaveProperty('jobType');
    expect(data[0]).toHaveProperty('status');
    expect(data[0]).toHaveProperty('stage');
    expect(data[0]).toHaveProperty('createdAt');
  });
});
