import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import * as submissionService from '@/server/grant-ops/submission-service';
export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get('grantId');
    const statusFilter = searchParams.get('status');

    const followUps = await submissionService.getFollowUps();

    let filtered = followUps;

    if (grantId) {
      filtered = filtered.filter((f) => f.grantId === grantId);
    }

    if (statusFilter && ['pending', 'overdue', 'completed'].includes(statusFilter)) {
      filtered = filtered.filter((f) => f.status === statusFilter);
    }

    return NextResponse.json(filtered);
  } catch (error) {
    logger.error({ err: error }, 'Error getting follow-ups');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get follow-ups'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json();

    if (!body.id || !body.title) {
      return NextResponse.json(
        { error: 'ID and title are required' },
        { status: 400 },
      );
    }

    const followUp = await submissionService.createFollowUp({
      id: body.id,
      grantId: body.grantId,
      submissionId: body.submissionId,
      type: body.type || 'other',
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      status: body.status || 'pending',
      completedAt: body.completedAt,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(followUp, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error creating follow-up');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create follow-up'), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  await connection();
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'ID is required'), { status: 400 });
    }

    await submissionService.updateFollowUp({
      id: body.id,
      grantId: body.grantId,
      submissionId: body.submissionId,
      type: body.type || 'other',
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      status: body.status || 'pending',
      completedAt: body.completedAt,
      createdAt: body.createdAt || new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error updating follow-up');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to update follow-up'), { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Follow-up ID is required'), { status: 400 });
    }

    const deleted = await submissionService.deleteFollowUp(id);

    if (!deleted) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Follow-up not found'), { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting follow-up');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to delete follow-up'), { status: 500 });
  }
}
