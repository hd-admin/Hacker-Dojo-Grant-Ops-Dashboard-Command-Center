import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const deps = getDependencies();
    const existing = await deps.repository.getJobQueueItem(jobId);
    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (existing.status !== 'failed') {
      return NextResponse.json({ error: 'Only failed jobs can be retried' }, { status: 400 });
    }

    const newJobId = deps.idGenerator.generateId('job');
    await deps.repository.addJobQueueItem({
      ...existing,
      id: newJobId,
      status: 'queued',
      stage: 'retrying',
      lastUpdate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      retryCount: (existing.retryCount ?? 0) + 1,
    });
    return NextResponse.json({ success: true, newJobId });
  } catch (error) {
    console.error('Error retrying job:', error);
    return NextResponse.json({ error: 'Failed to retry job' }, { status: 500 });
  }
}
