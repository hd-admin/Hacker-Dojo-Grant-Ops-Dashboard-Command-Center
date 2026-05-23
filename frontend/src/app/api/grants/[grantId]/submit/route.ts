import { NextRequest, NextResponse } from 'next/server';
import * as submissionService from '@/server/grant-ops/submission-service';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
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
    const body = await request.json().catch(() => null);
    const deps = getDependencies();

    if (!body || typeof body.method !== 'object' || !body.method || typeof body.method.type !== 'string') {
      return NextResponse.json({ error: 'Submission method is required' }, { status: 400 });
    }

    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    const result = await submissionService.recordSubmission({
      grant,
      method: {
        type: body.method.type,
        portalUrl: typeof body.method.portalUrl === 'string' ? body.method.portalUrl : undefined,
        confirmationId: typeof body.method.confirmationId === 'string' ? body.method.confirmationId : undefined,
        submittedBy: typeof body.method.submittedBy === 'string' ? body.method.submittedBy : 'human',
      },
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      submittedBy: typeof body.method.submittedBy === 'string' ? body.method.submittedBy : 'human',
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to record submission' }, { status: 400 });
    }

    return NextResponse.json({ success: true, submissionRecord: result.submissionRecord, followUps: result.followUps }, { status: 201 });
  } catch (error) {
    console.error('Error recording submission:', error);
    return NextResponse.json({ error: 'Failed to record submission' }, { status: 500 });
  }
}
