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
    const approval = await submissionService.getApprovalRecord(grantId);
    return NextResponse.json(approval);
  } catch (error) {
    console.error('Error getting approval:', error);
    return NextResponse.json({ error: 'Failed to get approval' }, { status: 500 });
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

    if (!body || (body.approvedBy !== undefined && typeof body.approvedBy !== 'string')) {
      return NextResponse.json({ error: 'ApprovedBy must be a string when provided' }, { status: 400 });
    }

    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    const result = await submissionService.approveGrant({
      grant,
      approvedBy: body.approvedBy || 'human',
      lockedUntil: typeof body.lockedUntil === 'string' ? body.lockedUntil : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to approve grant' }, { status: 400 });
    }

    return NextResponse.json({ success: true, approvalRecord: result.approvalRecord }, { status: 201 });
  } catch (error) {
    console.error('Error approving grant:', error);
    return NextResponse.json({ error: 'Failed to approve grant' }, { status: 500 });
  }
}
