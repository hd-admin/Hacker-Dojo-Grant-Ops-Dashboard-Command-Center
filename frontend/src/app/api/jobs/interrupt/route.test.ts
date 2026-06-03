import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../shared/grant-ops-persistence';
import type { JobQueueItem } from '../../../../../../shared/types';
import {
  createDependencies,
  resetDependencies,
  setDependencies,
} from '@/server/grant-ops/dependencies';
import * as repository from '../../../../server/grant-ops/repository';
import { POST } from './route';

function createJob(id: string, status: JobQueueItem['status']): JobQueueItem {
  return {
    id,
    jobType: 'research',
    status,
    stage: status === 'queued' ? 'queued' : status === 'running' ? 'analyzing' : status,
    lastUpdate: '2026-06-03T00:00:00.000Z',
    createdAt: '2026-06-03T00:00:00.000Z',
    entityId: 'grant-1',
    retryCount: 0,
  };
}

describe('/api/jobs/interrupt route', () => {
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

  it('interrupts multiple queued jobs', async () => {
    await repository.addJobQueueItem(createJob('job-a', 'queued'));
    await repository.addJobQueueItem(createJob('job-b', 'queued'));

    const response = await POST(
      new Request('http://localhost/api/jobs/interrupt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobIds: ['job-a', 'job-b'] }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toHaveLength(2);

    const jobA = await repository.getJobQueueItem('job-a');
    const jobB = await repository.getJobQueueItem('job-b');
    expect(jobA?.status).toBe('cancelled');
    expect(jobB?.status).toBe('cancelled');
  });

  it('interrupts running jobs', async () => {
    await repository.addJobQueueItem(createJob('job-run', 'running'));

    const response = await POST(
      new Request('http://localhost/api/jobs/interrupt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobIds: ['job-run'] }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.results[0].cancelled).toBe(true);

    const job = await repository.getJobQueueItem('job-run');
    expect(job?.status).toBe('cancelled');
  });

  it('returns 207 when only some jobs are cancellable', async () => {
    await repository.addJobQueueItem(createJob('job-queued', 'queued'));
    await repository.addJobQueueItem(createJob('job-done', 'completed'));

    const response = await POST(
      new Request('http://localhost/api/jobs/interrupt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobIds: ['job-queued', 'job-done'] }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(207);
    expect(data.success).toBe(false);

    const queued = await repository.getJobQueueItem('job-queued');
    expect(queued?.status).toBe('cancelled');
  });

  it('reports not-found jobs in results', async () => {
    await repository.addJobQueueItem(createJob('job-real', 'queued'));

    const response = await POST(
      new Request('http://localhost/api/jobs/interrupt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobIds: ['job-real', 'job-missing'] }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(207);
    const missing = data.results.find((r: { jobId: string }) => r.jobId === 'job-missing');
    expect(missing.cancelled).toBe(false);
    expect(missing.reason).toMatch(/not found/i);

    const real = await repository.getJobQueueItem('job-real');
    expect(real?.status).toBe('cancelled');
  });

  it('validates jobIds array is required and non-empty', async () => {
    const response = await POST(
      new Request('http://localhost/api/jobs/interrupt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobIds: [] }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('validates body is a JSON object', async () => {
    const response = await POST(
      new Request('http://localhost/api/jobs/interrupt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});
