import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { JobQueueItem } from '../../../../../../../shared/types';
import { createDependencies, resetDependencies, setDependencies } from '@/server/grant-ops/dependencies';
import * as repository from '../../../../../server/grant-ops/repository';
import { POST } from './route';

function createJob(id: string, status: JobQueueItem['status']): JobQueueItem {
  return {
    id,
    jobType: 'research',
    status,
    stage: status === 'queued' ? 'queued' : 'running-fetch',
    lastUpdate: '2026-05-27T00:00:00.000Z',
    createdAt: '2026-05-27T00:00:00.000Z',
    entityId: 'grant-123',
    retryCount: 0,
  };
}

describe('/api/jobs/[jobId]/cancel route', () => {
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

  it('cancels a queued job and returns the updated record', async () => {
    await repository.addJobQueueItem(createJob('job-queued', 'queued'));

    const response = await POST(new Request('http://localhost/api/jobs/job-queued/cancel', {
      method: 'POST',
    }) as never, {
      params: Promise.resolve({ jobId: 'job-queued' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('job-queued');
    expect(data.status).toBe('cancelled');

    const updated = await repository.getJobQueueItem('job-queued');
    expect(updated?.status).toBe('cancelled');
    expect(updated?.completedAt).toBeDefined();
  });

  it('returns 404 for nonexistent job', async () => {
    const response = await POST(new Request('http://localhost/api/jobs/nonexistent/cancel', {
      method: 'POST',
    }) as never, {
      params: Promise.resolve({ jobId: 'nonexistent' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Job not found/i);
  });

  it('returns 409 for already-completed job', async () => {
    await repository.addJobQueueItem(createJob('job-done', 'completed'));

    const response = await POST(new Request('http://localhost/api/jobs/job-done/cancel', {
      method: 'POST',
    }) as never, {
      params: Promise.resolve({ jobId: 'job-done' }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toMatch(/cannot be cancelled/i);
    expect(data.currentStatus).toBe('completed');
  });
});
