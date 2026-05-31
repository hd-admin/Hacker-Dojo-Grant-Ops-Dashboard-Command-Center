import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import * as submissionService from '@/server/grant-ops/submission-service';
import type { ApprovalInput } from '@/server/grant-ops/submission-service';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  await connection();
  try {
    const { grantId } = await params;
    const approval = await submissionService.getApprovalRecord(grantId);
    return NextResponse.json(approval);
  } catch (error) {
    logger.error({ err: error }, 'Error getting approval');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get approval'), { status: 500 });
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

    if (!body || (body.approvedBy !== undefined && typeof body.approvedBy !== 'string')) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'ApprovedBy must be a string when provided'), { status: 400 });
    }

    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Grant not found'), { status: 404 });
    }

    const approvalInput: ApprovalInput = {
      grant,
      approvedBy: body.approvedBy || 'human',
    };
    if (typeof body.lockedUntil === 'string') approvalInput.lockedUntil = body.lockedUntil;
    const result = await submissionService.approveGrant(approvalInput);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to approve grant' }, { status: 400 });
    }

    return NextResponse.json({ success: true, approvalRecord: result.approvalRecord }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error approving grant');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to approve grant'), { status: 500 });
  }
}
