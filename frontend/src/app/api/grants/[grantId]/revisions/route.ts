import { NextRequest, NextResponse } from 'next/server';
import * as repository from '@/server/grant-ops/repository';
import * as draftingService from '@/server/grant-ops/drafting-service';
import type { RevisionRequest } from '../../../../../../../shared/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const revisions = await repository.getRevisionRequests(grantId);
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
  try {
    const { grantId } = await params;
    const body = await request.json();

    const grant = await repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    // Get organization profile for draft generation
    const profile = await repository.getOrgProfile();
    if (!profile) {
      return NextResponse.json(
        { error: 'Organization profile not configured. Please set up your profile in Settings.' },
        { status: 400 },
      );
    }

    // Get the latest draft version for this grant
    const latestDraft = await repository.getLatestDraftArtifact(grantId);
    const draftVersion = latestDraft ? latestDraft.version + 1 : 1;

    const revision: RevisionRequest = {
      id: `revision-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      grantId,
      draftVersion,
      notes: body.notes || '',
      requestedAt: new Date().toISOString(),
      requestedBy: body.requestedBy || 'human',
      status: 'pending',
    };

    await repository.addRevisionRequest(revision);

    // Generate a new draft version with revision notes (GAP-WF-08 fix)
    const newDraft = await draftingService.generateDraft(grant, profile, {
      revisionNotes: body.notes || '',
    });

    // Move grant back to draft status for revision (does not change board column)
    await repository.updateGrant(grantId, {
      status: 'draft',
      statusLabel: 'Drafting',
    });

    return NextResponse.json(
      { revision, draft: newDraft },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating revision:', error);
    return NextResponse.json({ error: 'Failed to create revision' }, { status: 500 });
  }
}
