import { NextRequest, NextResponse } from 'next/server';
import * as draftingService from '@/server/grant-ops/drafting-service';
import { getDependencies } from '@/server/grant-ops/dependencies';
export const dynamic = 'force-dynamic';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const drafts = await draftingService.getDraftArtifacts(grantId);
    return NextResponse.json(drafts);
  } catch (error) {
    console.error('Error getting drafts:', error);
    return NextResponse.json({ error: 'Failed to get drafts' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const body = await request.json();
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

    const draft = await draftingService.generateDraft(grant, profile, {
      revisionNotes: body.revisionNotes,
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error generating draft:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate draft';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
