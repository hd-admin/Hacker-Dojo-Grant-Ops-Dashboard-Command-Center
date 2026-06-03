import { NextRequest, NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { cancelQueuedJob } from '@/server/grant-ops/job-queue-service';

export const dynamic = 'force-dynamic';

const interruptSchema = z.object({
  jobIds: z.array(z.string()).min(1),
});

interface InterruptResult {
  jobId: string;
  cancelled: boolean;
  reason?: string;
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Request body must be a JSON object'),
        { status: 400 },
      );
    }

    const parsed = interruptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid interrupt payload', {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        }),
        { status: 400 },
      );
    }

    const deps = getDependencies();
    const results: InterruptResult[] = [];

    for (const jobId of parsed.data.jobIds) {
      try {
        const job = await deps.repository.getJobQueueItem(jobId);
        if (!job) {
          results.push({ jobId, cancelled: false, reason: 'Job not found' });
          continue;
        }
        if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
          results.push({
            jobId,
            cancelled: false,
            reason: `Job already in terminal state: ${job.status}`,
          });
          continue;
        }
        const cancelled = await cancelQueuedJob(jobId);
        results.push({ jobId, cancelled });
      } catch (error) {
        logger.error({ err: error, jobId }, 'Error interrupting job');
        results.push({ jobId, cancelled: false, reason: 'Internal error interrupting job' });
      }
    }

    const allCancelled = results.every((r) => r.cancelled);
    return NextResponse.json(
      { success: allCancelled, results },
      { status: allCancelled ? 200 : 207 },
    );
  } catch (error) {
    logger.error({ err: error }, 'Error interrupting jobs');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to interrupt jobs'),
      { status: 500 },
    );
  }
}
