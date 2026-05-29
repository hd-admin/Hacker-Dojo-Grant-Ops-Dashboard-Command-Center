/**
 * Job Queue Service Tests
 *
 * Tests for retry, cancel, progress, and classification operations.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JobQueueItem } from '../../../../shared/types';
import {
	cancelQueuedJob,
	classifyJobFailureCategory,
	getJobProgress,
	retryQueuedJob,
	updateJobProgress,
} from './job-queue-service';
import {
	createDependencies,
	resetDependencies,
	setDependencies,
} from './dependencies';
import * as repository from './repository';

function createFailedJob(id: string, overrides: Partial<JobQueueItem> = {}): JobQueueItem {
	return {
		id,
		jobType: 'research',
		status: 'failed',
		stage: 'failed',
		lastUpdate: '2026-05-28T12:00:00.000Z',
		createdAt: '2026-05-28T12:00:00.000Z',
		retryCount: 0,
		entityId: 'grant-1',
		errorMessage: 'Test error',
		failureCategory: 'connectivity',
		...overrides,
	};
}

function createRunningJob(id: string): JobQueueItem {
	return {
		id,
		jobType: 'draft',
		status: 'running',
		stage: 'drafting',
		lastUpdate: '2026-05-28T12:00:00.000Z',
		createdAt: '2026-05-28T12:00:00.000Z',
		retryCount: 0,
		entityId: 'grant-2',
	};
}

describe('job-queue-service', () => {
	afterEach(() => {
		resetDependencies();
	});

	beforeEach(() => {
		setDependencies(createDependencies());
	});

	describe('classifyJobFailureCategory', () => {
		it('classifies rate-limit errors', () => {
			expect(classifyJobFailureCategory(new Error('429 Too Many Requests'))).toBe('rate-limit');
			expect(classifyJobFailureCategory(new Error('rate limit exceeded'))).toBe('rate-limit');
		});

		it('classifies quota-exhausted errors', () => {
			expect(classifyJobFailureCategory(new Error('quota exceeded for today'))).toBe('quota-exhausted');
		});

		it('classifies timeout errors', () => {
			expect(classifyJobFailureCategory(new Error('Operation timed out'))).toBe('timeout');
		});

		it('classifies capacity errors', () => {
			expect(classifyJobFailureCategory(new Error('resource exhausted'))).toBe('capacity');
			expect(classifyJobFailureCategory(new Error('server busy'))).toBe('capacity');
		});

		it('classifies connectivity errors', () => {
			expect(classifyJobFailureCategory(new Error('ENOENT: no such file'))).toBe('connectivity');
			expect(classifyJobFailureCategory(new Error('network unreachable'))).toBe('connectivity');
		});

		it('classifies logic errors', () => {
			expect(classifyJobFailureCategory(new Error('validation failed'))).toBe('logic');
			expect(classifyJobFailureCategory(new Error('invalid input'))).toBe('logic');
		});

		it('returns unknown for unrecognized errors', () => {
			expect(classifyJobFailureCategory(new Error('something happened'))).toBe('unknown');
		});
	});

	describe('retryQueuedJob', () => {
		it('creates a new queued job with incremented retryCount', async () => {
			const failedJob = createFailedJob('job-failed');
			await repository.addJobQueueItem(failedJob);

			const newJob = await retryQueuedJob(failedJob);
			expect(newJob).not.toBeNull();
			const job = newJob as JobQueueItem;
			expect(job.status).toBe('queued');
			expect(job.stage).toBe('retrying');
			expect(job.retryCount).toBe(1);
			expect(job.jobType).toBe('research');
			expect(job.entityId).toBe('grant-1');
			expect(job.id).not.toBe(failedJob.id);
		});

		it('returns null when maxRetries is exceeded', async () => {
			const overRetriedJob = createFailedJob('job-over-retried', { retryCount: 5 });
			const newJob = await retryQueuedJob(overRetriedJob, 5);
			expect(newJob).toBeNull();
		});

		it('respects custom maxRetries', async () => {
			const job = createFailedJob('job-custom', { retryCount: 3 });
			const newJob = await retryQueuedJob(job, 10);
			expect(newJob).not.toBeNull();
			const result = newJob as JobQueueItem;
			expect(result.retryCount).toBe(4);
		});

		it('defaults retryCount to 0 when missing', async () => {
			const { retryCount: _retryCount, ...rest } = createFailedJob('job-no-count');
			const failedJob: JobQueueItem = rest as unknown as JobQueueItem;
			const newJob = await retryQueuedJob(failedJob);
			expect(newJob?.retryCount).toBe(1);
		});
	});

	describe('cancelQueuedJob', () => {
		it('cancels a queued job', async () => {
			const job = createFailedJob('job-queued', { status: 'queued', stage: 'queued' });
			await repository.addJobQueueItem(job);

			const result = await cancelQueuedJob('job-queued');
			expect(result).toBe(true);

			const updated = await repository.getJobQueueItem('job-queued');
			expect(updated?.status).toBe('cancelled');
			expect(updated?.stage).toBe('cancelled');
			expect(updated?.completedAt).toBeTruthy();
		});

		it('cancels a running job', async () => {
			const job = createRunningJob('job-running');
			await repository.addJobQueueItem(job);

			const result = await cancelQueuedJob('job-running');
			expect(result).toBe(true);
		});

		it('returns false for non-existent job', async () => {
			const result = await cancelQueuedJob('nonexistent');
			expect(result).toBe(false);
		});

		it('returns false for already completed job', async () => {
			const job = createFailedJob('job-done', { status: 'completed', stage: 'completed' });
			await repository.addJobQueueItem(job);

			const result = await cancelQueuedJob('job-done');
			expect(result).toBe(false);
		});

		it('returns false for already failed job', async () => {
			const job = createFailedJob('job-failed');
			await repository.addJobQueueItem(job);

			const result = await cancelQueuedJob('job-failed');
			expect(result).toBe(false);
		});

		it('returns false for already cancelled job', async () => {
			const job = createFailedJob('job-cancelled', { status: 'cancelled', stage: 'cancelled' });
			await repository.addJobQueueItem(job);

			const result = await cancelQueuedJob('job-cancelled');
			expect(result).toBe(false);
		});
	});

	describe('updateJobProgress', () => {
		it('updates the stage of a job', async () => {
			const job = createRunningJob('job-progress');
			await repository.addJobQueueItem(job);

			await updateJobProgress('job-progress', 'analyzing');

			const updated = await repository.getJobQueueItem('job-progress');
			expect(updated?.stage).toBe('analyzing');
		});
	});

	describe('getJobProgress', () => {
		it('returns progress for a queued job', async () => {
			const job = createFailedJob('job-progress-1', { status: 'queued', stage: 'queued' });
			await repository.addJobQueueItem(job);

			const progress = await getJobProgress('job-progress-1');
			expect(progress).not.toBeNull();
			const result = progress as NonNullable<typeof progress>;
			expect(result.status).toBe('queued');
			expect(result.progress).toBe(0);
		});

		it('returns progress for a running job', async () => {
			const job = createRunningJob('job-progress-2');
			await repository.addJobQueueItem(job);

			const progress = await getJobProgress('job-progress-2');
			expect(progress).not.toBeNull();
			const result = progress as NonNullable<typeof progress>;
			expect(result.status).toBe('running');
			expect(result.progress).toBe(80);
		});

		it('returns 100 progress for completed jobs', async () => {
			const job = createFailedJob('job-progress-3', { status: 'completed', stage: 'completed' });
			await repository.addJobQueueItem(job);

			const progress = await getJobProgress('job-progress-3');
			const result = progress as NonNullable<typeof progress>;
			expect(result.progress).toBe(100);
		});

		it('returns null for non-existent job', async () => {
			const progress = await getJobProgress('nonexistent');
			expect(progress).toBeNull();
		});

		it('defaults stage to queued for missing stage', async () => {
			const baseJob = createFailedJob('job-progress-4', { status: 'queued' });
			 
			const { stage: _stage, ...jobFields } = baseJob;
			const job = jobFields as JobQueueItem;
			await repository.addJobQueueItem(job);

			const progress = await getJobProgress('job-progress-4');
			const result = progress as NonNullable<typeof progress>;
			expect(result.stage).toBe('queued');
		});
	});
});
