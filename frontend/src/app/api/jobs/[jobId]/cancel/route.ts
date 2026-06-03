import { type NextRequest, NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { revalidateAfterMutation } from '@/lib/revalidate';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { cancelQueuedJob } from '@/server/grant-ops/job-queue-service';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  jobId: z.string().min(1),
});

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  await connection();
  try {
    const { jobId } = await params;
    if (!paramsSchema.safeParse({ jobId }).success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid job ID'),
        { status: 400 },
      );
    }
    const deps = getDependencies();

    const job = await deps.repository.getJobQueueItem(jobId);
    if (!job) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Job not found'), {
        status: 404,
      });
    }

    if (job.status !== 'queued' && job.status !== 'running') {
      return NextResponse.json(
        { error: 'Job cannot be cancelled in current state', currentStatus: job.status },
        { status: 409 },
      );
    }

    await cancelQueuedJob(jobId);

    const updated = await deps.repository.getJobQueueItem(jobId);
    revalidateAfterMutation();
    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Error cancelling job');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to cancel job'), {
      status: 500,
    });
  }
}
