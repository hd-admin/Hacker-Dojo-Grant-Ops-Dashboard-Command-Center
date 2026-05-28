/**
 * Job Detail API Route Tests
 *
 * Tests the /api/jobs/[jobId] GET and DELETE routes.
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
import type { JobQueueItem } from '../../../../../../shared/types';
import * as repository from '../../../../server/grant-ops/repository';
import { DELETE, GET } from './route';

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

const jobParams = (jobId: string) => ({ params: Promise.resolve({ jobId }) });

describe('/api/jobs/[jobId] route', () => {
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

  describe('GET', () => {
    it('returns a single job by id', async () => {
      await repository.addJobQueueItem(createJob('job-1', 'queued'));

      const response = await GET(
        new Request('http://localhost/api/jobs/job-1') as never,
        jobParams('job-1'),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('job-1');
      expect(data.jobType).toBe('research');
      expect(data.status).toBe('queued');
      expect(data.entityId).toBe('grant-1');
    });

    it('returns 404 for non-existent job', async () => {
      const response = await GET(
        new Request('http://localhost/api/jobs/missing') as never,
        jobParams('missing'),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toMatch(/Job not found/i);
    });

    it('returns correct job when multiple jobs exist', async () => {
      await repository.addJobQueueItem(createJob('job-a', 'queued'));
      await repository.addJobQueueItem(createJob('job-b', 'completed'));

      const response = await GET(
        new Request('http://localhost/api/jobs/job-b') as never,
        jobParams('job-b'),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('job-b');
      expect(data.status).toBe('completed');
    });
  });

  describe('DELETE', () => {
    it('cancels a queued job', async () => {
      await repository.addJobQueueItem(createJob('job-1', 'queued'));

      const response = await DELETE(
        new Request('http://localhost/api/jobs/job-1', { method: 'DELETE' }) as never,
        jobParams('job-1'),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify job was cancelled
      const job = await repository.getJobQueueItem('job-1');
      expect(job?.status).toBe('cancelled');
      expect(job?.errorMessage).toBe('Cancelled by operator');
    });

    it('cancels a running job', async () => {
      await repository.addJobQueueItem(createJob('job-2', 'running'));

      const response = await DELETE(
        new Request('http://localhost/api/jobs/job-2', { method: 'DELETE' }) as never,
        jobParams('job-2'),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      const job = await repository.getJobQueueItem('job-2');
      expect(job?.status).toBe('cancelled');
      expect(job?.completedAt).toBeDefined();
    });

    it('rejects cancellation of completed job', async () => {
      await repository.addJobQueueItem(createJob('job-3', 'completed'));

      const response = await DELETE(
        new Request('http://localhost/api/jobs/job-3', { method: 'DELETE' }) as never,
        jobParams('job-3'),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.reason).toMatch(/not cancellable/i);
    });

    it('rejects cancellation of failed job', async () => {
      await repository.addJobQueueItem(createJob('job-4', 'failed'));

      const response = await DELETE(
        new Request('http://localhost/api/jobs/job-4', { method: 'DELETE' }) as never,
        jobParams('job-4'),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('rejects cancellation of already cancelled job', async () => {
      await repository.addJobQueueItem(createJob('job-5', 'cancelled'));

      const response = await DELETE(
        new Request('http://localhost/api/jobs/job-5', { method: 'DELETE' }) as never,
        jobParams('job-5'),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 404 when cancelling non-existent job', async () => {
      const response = await DELETE(
        new Request('http://localhost/api/jobs/missing', { method: 'DELETE' }) as never,
        jobParams('missing'),
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toMatch(/Job not found/i);
    });
  });
});
