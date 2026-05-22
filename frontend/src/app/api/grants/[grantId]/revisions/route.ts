import { NextRequest, NextResponse } from 'next/server';
import * as repository from '@/server/grant-ops/repository';
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

    // Move grant back to draft status for revision (does not change board column)
    await repository.updateGrant(grantId, {
      status: 'draft',
      statusLabel: 'In Draft',
    });

    return NextResponse.json(revision, { status: 201 });
  } catch (error) {
    console.error('Error creating revision:', error);
    return NextResponse.json({ error: 'Failed to create revision' }, { status: 500 });
  }
}
