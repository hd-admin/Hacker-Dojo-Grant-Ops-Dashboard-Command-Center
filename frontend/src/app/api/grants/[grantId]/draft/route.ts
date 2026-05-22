import { NextRequest, NextResponse } from 'next/server';
import * as draftingService from '@/server/grant-ops/drafting-service';
import * as repository from '@/server/grant-ops/repository';

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

    const grant = await repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    const profile = await repository.getOrgProfile();
    if (!profile) {
      return NextResponse.json(
        { error: 'Organization profile not configured' },
        { status: 400 },
      );
    }

    const draft = await draftingService.generateDraft(grant, profile, {
      revisionNotes: body.revisionNotes,
      opencodeProvider: body.opencodeProvider,
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error('Error generating draft:', error);
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}
