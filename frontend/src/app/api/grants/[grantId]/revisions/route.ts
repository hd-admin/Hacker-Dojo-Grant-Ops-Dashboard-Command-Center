import { NextRequest, NextResponse } from 'next/server';
import * as draftingService from '@/server/grant-ops/drafting-service';
import { getDependencies } from '@/server/grant-ops/dependencies';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
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
  try {
    const { grantId } = await params;
    const body = await request.json();
    const deps = getDependencies();

    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    // Get organization profile for draft generation
    const profile = await deps.repository.getOrgProfile();
    if (!profile) {
      return NextResponse.json(
        { error: 'Organization profile not configured. Please set up your profile in Settings.' },
        { status: 400 },
      );
    }

    // Check if Opencode is configured for CLI mode
    const settings = await deps.repository.getOpencodeSettings();
    
    // Require CLI provider in production - fail explicitly if not configured
    if (!settings?.isConfigured) {
      return NextResponse.json(
        { error: 'Opencode is not configured. Please set up Opencode settings in the application before generating revisions.' },
        { status: 400 },
      );
    }

    // Create revision request using the draftingService
    const revision = await draftingService.createRevisionRequest(
      grant,
      body.notes || '',
      body.requestedBy || 'human',
    );

    // Generate a new draft version with revision notes
    // Always use CLI provider when Opencode is configured
    const newDraft = await draftingService.generateDraft(grant, profile, {
      revisionNotes: body.notes || '',
      opencodeProvider: 'cli',
    });

    return NextResponse.json(
      { revision, draft: newDraft },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating revision:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create revision';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
