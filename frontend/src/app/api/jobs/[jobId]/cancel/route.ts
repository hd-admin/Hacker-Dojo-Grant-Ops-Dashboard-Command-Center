import { type NextRequest, NextResponse, connection } from "next/server";
import { getDependencies } from '@/server/grant-ops/dependencies';
import { cancelQueuedJob } from '@/server/grant-ops/job-queue-service';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  await connection();
  try {
    const { jobId } = await params;
    const deps = getDependencies();

    const job = await deps.repository.getJobQueueItem(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'queued' && job.status !== 'running') {
      return NextResponse.json(
        { error: 'Job cannot be cancelled in current state', currentStatus: job.status },
        { status: 409 },
      );
    }

    await cancelQueuedJob(jobId);

    const updated = await deps.repository.getJobQueueItem(jobId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error cancelling job:', error);
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
  }
}
