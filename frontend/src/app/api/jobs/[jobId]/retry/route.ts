import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';
import * as draftingService from '@/server/grant-ops/drafting-service';
import * as researchService from '@/server/grant-ops/research-service';
import { executeQueuedJob } from '@/server/grant-ops/job-queue-service';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  await connection();
  try {
    const { jobId } = await params;
    const deps = getDependencies();
    const existing = await deps.repository.getJobQueueItem(jobId);
    if (!existing) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Job not found'), { status: 404 });
    }
    if (existing.status !== 'failed') {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Only failed jobs can be retried'), { status: 400 });
    }

    const newJobId = deps.idGenerator.generateId('job');
    // Preserve partialOutput from the failed job so operators can inspect partial content
    const partialOutput = existing.partialOutput;
    await deps.repository.addJobQueueItem({
      id: newJobId,
      jobType: existing.jobType,
      status: 'queued',
      stage: 'retrying',
      lastUpdate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      retryCount: (existing.retryCount ?? 0) + 1,
      ...(existing.entityId ? { entityId: existing.entityId } : {}),
      // Preserve partialOutput from the original failed job
      ...(partialOutput ? { partialOutput } : {}),
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
        {
          ...(latestRevisionNotes ? { revisionNotes: latestRevisionNotes } : {}),
          _jobId: newJobId,
        },
      );
      return `Draft v${draft.version} generated for ${grant.title}`;
    }).catch((error) => {
      logger.error({ err: error }, 'Retry execution failed');
    });

    return NextResponse.json({ success: true, newJobId }, { status: 202 });
  } catch (error) {
    logger.error({ err: error }, 'Error retrying job');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to retry job'), { status: 500 });
  }
}
