import type { JobFailureCategory, JobQueueItem } from '../../../../shared/types';
import { getDependencies } from './dependencies';

export type JobRunner = () => Promise<string>;

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
