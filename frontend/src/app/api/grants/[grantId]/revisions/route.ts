import { NextRequest, NextResponse, connection } from "next/server";
import * as draftingService from '@/server/grant-ops/drafting-service';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

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
    console.error('Error getting revisions:', error);
    return NextResponse.json({ error: 'Failed to get revisions' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  await connection();
  try {
    const { grantId } = await params;
    const body = await request.json().catch(() => null);
    const deps = getDependencies();

    if (!body || (body.notes !== undefined && typeof body.notes !== 'string')) {
      return NextResponse.json({ error: 'Revision notes are required' }, { status: 400 });
    }

    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
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
    console.error('Error creating revision:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create revision';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
