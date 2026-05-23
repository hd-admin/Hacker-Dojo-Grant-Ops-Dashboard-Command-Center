import { NextRequest, NextResponse } from 'next/server';
import * as submissionService from '@/server/grant-ops/submission-service';
import { getDependencies } from '@/server/grant-ops/dependencies';
export const dynamic = 'force-dynamic';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const submission = await submissionService.getSubmissionRecord(grantId);
    return NextResponse.json(submission);
  } catch (error) {
    console.error('Error getting submission:', error);
    return NextResponse.json({ error: 'Failed to get submission' }, { status: 500 });
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

    // Validate submission method
    if (!body.method || !body.method.type) {
      return NextResponse.json(
        { error: 'Submission method is required' },
        { status: 400 },
      );
    }

    const result = await submissionService.recordSubmission({
      grant,
      method: {
        type: body.method.type,
        portalUrl: body.method.portalUrl,
        confirmationId: body.method.confirmationId,
        submittedBy: body.method.submittedBy || 'human',
      },
      notes: body.notes,
      submittedBy: body.method.submittedBy || 'human',
    });

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  } catch (error) {
    console.error('Error recording submission:', error);
    return NextResponse.json({ error: 'Failed to record submission' }, { status: 500 });
  }
}
