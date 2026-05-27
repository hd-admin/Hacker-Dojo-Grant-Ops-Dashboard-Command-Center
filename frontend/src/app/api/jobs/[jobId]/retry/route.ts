import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
import * as draftingService from '@/server/grant-ops/drafting-service';
import * as researchService from '@/server/grant-ops/research-service';
import { executeQueuedJob } from '@/server/grant-ops/job-queue-service';

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

    void executeQueuedJob(newJobId, 'retrying', async () => {
      if (existing.jobType === 'research') {
        const profile = await deps.repository.getOrgProfile();
        if (!profile) {
          throw new Error('Organization profile not configured');
        }
        const result = await researchService.runResearch(profile);
        if (!result.crawlRun || result.crawlRun.status === 'failed') {
          throw new Error(result.error || 'Research retry failed');
        }
        return `Research completed: ${result.grantsMatched} grant(s) matched across ${result.crawlRun.sourcesCrawled} source(s)`;
      }

      if (!existing.entityId) {
        throw new Error('Draft retry missing grant reference');
      }
      const grant = await deps.repository.getGrant(existing.entityId);
      if (!grant) {
        throw new Error('Grant not found for draft retry');
      }
      const profile = await deps.repository.getOrgProfile();
      if (!profile) {
        throw new Error('Organization profile not configured');
      }
      const revisionRequests = await draftingService.getRevisionRequests(grant.id);
      const latestRevisionNotes = revisionRequests.at(-1)?.notes ?? '';
      const draft = await draftingService.generateDraft(
        grant,
        profile,
        latestRevisionNotes ? { revisionNotes: latestRevisionNotes } : {},
      );
      return `Draft v${draft.version} generated for ${grant.title}`;
    }).catch((error) => {
      console.error('Retry execution failed:', error);
    });

    return NextResponse.json({ success: true, newJobId }, { status: 202 });
  } catch (error) {
    console.error('Error retrying job:', error);
    return NextResponse.json({ error: 'Failed to retry job' }, { status: 500 });
  }
}
