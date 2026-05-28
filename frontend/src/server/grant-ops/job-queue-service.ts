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

export async function executeQueuedJob(jobId: string, stage: string, runner: JobRunner): Promise<void> {
  const deps = getDependencies();
  await deps.repository.updateJobQueueItem(jobId, {
    status: 'running',
    stage,
    startedAt: now(),
    lastUpdate: now(),
  });

  try {
    const resultSummary = await runner();
    await deps.repository.updateJobQueueItem(jobId, {
      status: 'completed',
      stage: 'completed',
      completedAt: now(),
      lastUpdate: now(),
      resultSummary,
      errorMessage: undefined,
      failureCategory: undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job failed';
    await deps.repository.updateJobQueueItem(jobId, {
      status: 'failed',
      stage: 'failed',
      completedAt: now(),
      lastUpdate: now(),
      errorMessage: message,
      failureCategory: classifyJobFailureCategory(error),
    });
  }
}

export async function enqueueJob(job: Pick<JobQueueItem, 'jobType' | 'entityId' | 'retryCount'>, stage: string, runner: JobRunner): Promise<JobQueueItem> {
  const queuedJob = await createQueuedJob(job);
  setTimeout(() => {
    void executeQueuedJob(queuedJob.id, stage, runner).catch((error) => {
      console.error('Queued job execution failed:', error);
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
		stage: 'retrying' as JobQueueItem['stage'],
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
		lastUpdate: job.lastUpdate,
		completedAt: job.completedAt,
		errorMessage: job.errorMessage,
	};
}
