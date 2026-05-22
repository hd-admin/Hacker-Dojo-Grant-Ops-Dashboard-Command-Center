import { NextRequest, NextResponse } from 'next/server';
import * as submissionService from '@/server/grant-ops/submission-service';
import * as repository from '@/server/grant-ops/repository';

export async function GET(
  request: NextRequest,
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
    const body = await request.json();

    const grant = await repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    const result = await submissionService.approveGrant({
      grant,
      approvedBy: body.approvedBy || 'human',
      lockedUntil: body.lockedUntil,
    });

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  } catch (error) {
    console.error('Error approving grant:', error);
    return NextResponse.json({ error: 'Failed to approve grant' }, { status: 500 });
  }
}
