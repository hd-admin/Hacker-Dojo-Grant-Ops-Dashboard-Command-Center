import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  await connection();
  try {
    const { jobId } = await params;
    const deps = getDependencies();
    const job = await deps.repository.getJobQueueItem(jobId);
    if (!job) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Job not found'), { status: 404 });
    }
    return NextResponse.json(job);
  } catch (error) {
    logger.error({ err: error }, 'Error loading job');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to load job'), { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  await connection();
  try {
    const { jobId } = await params;
    const deps = getDependencies();
    const job = await deps.repository.getJobQueueItem(jobId);
    if (!job) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Job not found'), { status: 404 });
    }
    if (job.status !== 'queued' && job.status !== 'running') {
      return NextResponse.json({ success: false, reason: 'Job not cancellable in current state' }, { status: 400 });
    }

    await deps.repository.updateJobQueueItem(jobId, {
      status: 'cancelled',
      lastUpdate: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      errorMessage: 'Cancelled by operator',
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error cancelling job');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to cancel job'), { status: 500 });
  }
}
