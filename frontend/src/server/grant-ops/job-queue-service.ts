import 'server-only';
import { logger } from '@/lib/logger';
import type { JobFailureCategory, JobQueueItem } from '../../../../shared/types';
import { getDependencies } from './dependencies';

export type JobRunner = () => Promise<string>;
export type JobProgressStage =
	| 'queued'
	| 'retrying'
	| 'preparing'
	| 'fetching'
	| 'analyzing'
	| 'drafting'
	| 'completed'
	| 'failed'
	| 'cancelled';

function now(): string {
  return getDependencies().clock.now().toISOString();
}

async function getBackoffMultiplier(): Promise<number> {
	try {
		const deps = getDependencies();
		const settings = await deps.repository.getOpencodeSettings();
		return settings?.backoffMultiplier ?? 1000;
	} catch {
		return 1000;
	}
}

export function classifyJobFailureCategory(error: unknown): JobFailureCategory {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/429|rate[- ]?limit/i.test(message)) return 'rate-limit';
  if (/quota/i.test(message)) return 'quota-exhausted';
  if (/timeout|timed out/i.test(message)) return 'timeout';
  if (/capacity|resource exhausted|busy/i.test(message)) return 'capacity';
  if (/enoent|not found|network|unreachable|connect/i.test(message)) return 'connectivity';
  return /logic|validation|parse|invalid/i.test(message) ? 'logic' : 'unknown';
}

export async function createQueuedJob(
  job: Pick<JobQueueItem, 'jobType' | 'entityId' | 'retryCount'>,
): Promise<JobQueueItem> {
  const deps = getDependencies();
  const timestamp = now();
  const queuedJob: JobQueueItem = {
    id: deps.idGenerator.generateId('job'),
    jobType: job.jobType,
    status: 'queued',
    stage: 'queued',
    lastUpdate: timestamp,
    createdAt: timestamp,
    retryCount: job.retryCount ?? 0,
    ...(job.entityId ? { entityId: job.entityId } : {}),
  };

  await deps.repository.addJobQueueItem(queuedJob);
  return queuedJob;
}

export async function executeQueuedJob(
	jobId: string,
	stage: string,
	runner: JobRunner,
): Promise<void> {
	const deps = getDependencies();
	await deps.repository.updateJobQueueItem(jobId, {
		status: 'running',
		stage,
		startedAt: now(),
		lastUpdate: now(),
	});

	const MAX_AUTO_RETRIES = 3;
	const MAX_TOTAL_DELAY_MS = 2 * 60 * 1000;
	let totalDelayMs = 0;
	let lastError: unknown;
	let lastPartialOutput: string | undefined;

	for (let attempt = 0; attempt <= MAX_AUTO_RETRIES; attempt++) {
		try {
			const resultSummary = await runner();
			await deps.repository.updateJobQueueItem(jobId, {
				status: 'completed',
				stage: 'completed',
				completedAt: now(),
				lastUpdate: now(),
				resultSummary,
			});
			return;
		} catch (error) {
			lastError = error;
			const category = classifyJobFailureCategory(error);
			const isTransient =
				category === 'rate-limit' ||
				category === 'timeout' ||
				category === 'connectivity';

			// Preserve partial output from error object when present
			if (
				error !== null &&
				typeof error === 'object' &&
				'partialOutput' in error
			) {
				const val = (error as Record<string, unknown>).partialOutput;
				if (typeof val === 'string') {
					lastPartialOutput = val;
				}
			}

			if (!isTransient || attempt >= MAX_AUTO_RETRIES) {
				break;
			}

			// Exponential backoff using configurable multiplier from opencode settings
			const multiplier = await getBackoffMultiplier();
			const backoffMs = multiplier * 2 ** attempt;
			if (totalDelayMs + backoffMs > MAX_TOTAL_DELAY_MS) {
				break;
			}
			totalDelayMs += backoffMs;

			await deps.repository.updateJobQueueItem(jobId, {
				stage: 'retrying',
				lastUpdate: now(),
			});
			await new Promise<void>((resolve) => setTimeout(resolve, backoffMs));
		}
	}

	// All retries exhausted — mark as failed
	const message =
		lastError instanceof Error ? lastError.message : 'Job failed';
	await deps.repository.updateJobQueueItem(jobId, {
		status: 'failed',
		stage: 'failed',
		completedAt: now(),
		lastUpdate: now(),
		errorMessage: message,
		failureCategory: classifyJobFailureCategory(lastError),
		...(lastPartialOutput ? { partialOutput: lastPartialOutput } : {}),
	});
}

export async function enqueueJob(job: Pick<JobQueueItem, 'jobType' | 'entityId' | 'retryCount'>, stage: string, runner: JobRunner): Promise<JobQueueItem> {
  const queuedJob = await createQueuedJob(job);
  setTimeout(() => {
    void executeQueuedJob(queuedJob.id, stage, runner).catch((error) => {
      logger.error({ err: error }, 'Queued job execution failed');
    });
  }, 0);
  return queuedJob;
}

/**
 * Retry a failed job by creating a new queued job with incremented retryCount.
 * Does NOT execute the job — the caller is responsible for starting execution.
 */
export async function retryQueuedJob(
	failedJob: JobQueueItem,
	maxRetries = 5,
): Promise<JobQueueItem | null> {
	const deps = getDependencies();
	const currentRetries = failedJob.retryCount ?? 0;

	if (currentRetries >= maxRetries) {
		return null;
	}

	const timestamp = now();
	const newJob: JobQueueItem = {
		id: deps.idGenerator.generateId('job'),
		jobType: failedJob.jobType,
		status: 'queued',
		stage: 'retrying',
		lastUpdate: timestamp,
		createdAt: timestamp,
		retryCount: currentRetries + 1,
		...(failedJob.entityId ? { entityId: failedJob.entityId } : {}),
	};

	await deps.repository.addJobQueueItem(newJob);
	return newJob;
}

/**
 * Cancel a queued or running job.
 * Returns false if the job is not in a cancellable state.
 */
export async function cancelQueuedJob(jobId: string): Promise<boolean> {
	const deps = getDependencies();
	const job = await deps.repository.getJobQueueItem(jobId);

	if (!job) {
		return false;
	}

	if (job.status !== 'queued' && job.status !== 'running') {
		return false;
	}

	await deps.repository.updateJobQueueItem(jobId, {
		status: 'cancelled',
		stage: 'cancelled',
		completedAt: now(),
		lastUpdate: now(),
	});

	return true;
}

/**
 * Restart a job by cancelling it (if active) and creating a fresh queued job
 * with retry count reset to 0. Returns the new job or null if the original job
 * was not found.
 */
export async function restartQueuedJob(
	jobId: string,
): Promise<JobQueueItem | null> {
	const deps = getDependencies();
	const job = await deps.repository.getJobQueueItem(jobId);

	if (!job) {
		return null;
	}

	// Cancel the existing job if it is still active
	if (job.status === 'queued' || job.status === 'running') {
		await cancelQueuedJob(jobId);
	}

	// Create a fresh job with retry count reset to 0
	const timestamp = now();
	const newJob: JobQueueItem = {
		id: deps.idGenerator.generateId('job'),
		jobType: job.jobType,
		status: 'queued',
		stage: 'queued',
		lastUpdate: timestamp,
		createdAt: timestamp,
		retryCount: 0,
		...(job.entityId ? { entityId: job.entityId } : {}),
	};

	await deps.repository.addJobQueueItem(newJob);
	return newJob;
}

/**
 * Update the progress stage of a running job.
 */
export async function updateJobProgress(
	jobId: string,
	stage: JobProgressStage,
): Promise<void> {
	const deps = getDependencies();
	await deps.repository.updateJobQueueItem(jobId, {
		stage,
		lastUpdate: now(),
	});
}

/**
 * Get the current progress status of a job.
 */
export async function getJobProgress(
	jobId: string,
): Promise<{
	id: string;
	status: string;
	stage: string;
	progress: number;
	retryCount: number;
	createdAt: string;
	lastUpdate?: string;
	completedAt?: string;
	errorMessage?: string;
} | null> {
	const deps = getDependencies();
	const job = await deps.repository.getJobQueueItem(jobId);

	if (!job) {
		return null;
	}

	const stageProgress: Record<string, number> = {
		queued: 0,
		retrying: 5,
		preparing: 10,
		fetching: 30,
		analyzing: 60,
		drafting: 80,
		completed: 100,
		failed: 100,
		cancelled: 100,
	};

	return {
		id: job.id,
		status: job.status,
		stage: job.stage ?? 'queued',
		progress: stageProgress[job.stage ?? 'queued'] ?? 0,
		retryCount: job.retryCount ?? 0,
		createdAt: job.createdAt,
		...(job.lastUpdate ? { lastUpdate: job.lastUpdate } : {}),
		...(job.completedAt ? { completedAt: job.completedAt } : {}),
		...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
	};
}
