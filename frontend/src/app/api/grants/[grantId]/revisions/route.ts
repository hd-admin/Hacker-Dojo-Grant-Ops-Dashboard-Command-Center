import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import * as draftingService from '@/server/grant-ops/drafting-service';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  notes: z.string().optional(),
  requestedBy: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  await connection();
  try {
    const { grantId } = await params;
    const deps = getDependencies();
    const revisions = await deps.repository.getRevisionRequests(grantId);
    return NextResponse.json(revisions);
  } catch (error) {
    logger.error({ err: error }, 'Error getting revisions');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get revisions'), { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  await connection();
  try {
    const { grantId } = await params;
    const rawBody = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid request body'), { status: 400 });
    }
    const body = parsed.data;
    const deps = getDependencies();

    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Grant not found'), { status: 404 });
    }

    const profile = await deps.repository.getOrgProfile();
    if (!profile) {
      return NextResponse.json(
        { error: 'Organization profile not configured. Please set up your profile in Settings.' },
        { status: 400 },
      );
    }

    const settings = await deps.repository.getOpencodeSettings();
    if (!settings?.isConfigured) {
      return NextResponse.json(
        { error: 'Opencode is not configured. Please set up Opencode settings in the application before generating revisions.' },
        { status: 400 },
      );
    }

    const revision = await draftingService.createRevisionRequest(
      grant,
      body.notes || '',
      typeof body.requestedBy === 'string' ? body.requestedBy : 'human',
    );

    const draft = await draftingService.generateDraft(grant, profile, {
      revisionNotes: body.notes || '',
    });

    return NextResponse.json({ revision, draft }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error creating revision');
    const errorMessage = error instanceof Error ? error.message : 'Failed to create revision';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
