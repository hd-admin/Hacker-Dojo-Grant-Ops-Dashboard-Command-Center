import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const deps = getDependencies();
    const job = await deps.repository.getJobQueueItem(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (error) {
    console.error('Error loading job:', error);
    return NextResponse.json({ error: 'Failed to load job' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const deps = getDependencies();
    const job = await deps.repository.getJobQueueItem(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
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
    console.error('Error cancelling job:', error);
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
  }
}
