import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { JobQueueItem } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { POST } from './route';

function createJob(id: string, status: JobQueueItem['status']): JobQueueItem {
  return {
    id,
    jobType: 'research',
    status,
    stage: status === 'failed' ? 'failed-fetch' : 'running-fetch',
    lastUpdate: '2026-05-27T00:00:00.000Z',
    createdAt: '2026-05-27T00:00:00.000Z',
    entityId: 'grant-123',
    retryCount: 1,
    errorMessage: status === 'failed' ? 'Timed out contacting provider' : undefined,
    failureCategory: status === 'failed' ? 'timeout' : undefined,
  };
}

describe('/api/jobs/[jobId]/retry route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('creates a queued retry job for a failed job', async () => {
    await repository.addJobQueueItem(createJob('job-failed', 'failed'));

    const response = await POST(new Request('http://localhost/api/jobs/job-failed/retry', {
      method: 'POST',
    }) as never, {
      params: Promise.resolve({ jobId: 'job-failed' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.newJobId).toMatch(/^job-/);

    const jobs = await repository.getJobQueue();
    expect(jobs).toHaveLength(2);
    const retried = jobs.find((job) => job.id === data.newJobId);
    expect(retried?.status).toBe('queued');
    expect(retried?.stage).toBe('retrying');
    expect(retried?.entityId).toBe('grant-123');
    expect(retried?.retryCount).toBe(2);
  });

  it('rejects retry attempts for jobs that are not failed', async () => {
    await repository.addJobQueueItem(createJob('job-running', 'running'));

    const response = await POST(new Request('http://localhost/api/jobs/job-running/retry', {
      method: 'POST',
    }) as never, {
      params: Promise.resolve({ jobId: 'job-running' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Only failed jobs can be retried/i);
  });
});
