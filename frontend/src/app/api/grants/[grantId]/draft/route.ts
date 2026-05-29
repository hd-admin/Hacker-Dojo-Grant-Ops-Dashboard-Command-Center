import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { opencodeFailureMessages } from '@/lib/failure-messages';
import { getDependencies } from '@/server/grant-ops/dependencies';
import * as draftingService from '@/server/grant-ops/drafting-service';
import { enqueueJob } from '@/server/grant-ops/job-queue-service';
import { classifyOpencodeError } from '@/server/grant-ops/opencode-client';
export const dynamic = 'force-dynamic';


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const drafts = await draftingService.getDraftArtifacts(grantId);
    return NextResponse.json(drafts);
  } catch (error) {
    console.error('Error getting drafts:', error);
    return NextResponse.json({ error: 'Failed to get drafts', failureCategory: 'unknown' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const rawBody = await request.text();
    const body = rawBody.trim() ? JSON.parse(rawBody) as { revisionNotes?: string } : {};
    const deps = getDependencies();

    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    const profile = await deps.repository.getOrgProfile();
    if (!profile) {
      return NextResponse.json(
        { error: 'Organization profile not configured' },
        { status: 400 },
      );
    }

    // Check if Opencode is configured - draftingService.generateDraft will fail explicitly if not
    const settings = await deps.repository.getOpencodeSettings();
    if (!settings?.isConfigured) {
      return NextResponse.json(
        { error: 'Opencode is not configured. Please set up Opencode settings before generating drafts.' },
        { status: 400 },
      );
    }

    let draftJobId: string | undefined;
    const job = await enqueueJob(
      { jobType: 'draft', entityId: grantId, retryCount: 0 },
      'drafting',
      async () => {
        const draft = await draftingService.generateDraft(
          grant,
          profile,
          {
            ...(body.revisionNotes ? { revisionNotes: body.revisionNotes } : {}),
            ...(draftJobId ? { _jobId: draftJobId } : {}),
          },
        );
        return `Draft v${draft.version} generated for ${grant.title}`;
      },
    );
    draftJobId = job.id;

    return NextResponse.json({ queued: true, job }, { status: 202 });
  } catch (error) {
    console.error('Error generating draft:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate draft';
    const failureMode = classifyOpencodeError(errorMessage);
    const guidance = opencodeFailureMessages[failureMode];
    const retryable = ['rate-limit', 'malformed-output', 'model-unavailable', 'timeout', 'unknown'].includes(failureMode);

    return NextResponse.json(
      {
        error: errorMessage,
        failureMode,
        retryable,
        guidance,
      },
      { status: 500 },
    );
  }
}
