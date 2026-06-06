import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import * as submissionService from '@/server/grant-ops/submission-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  id: z.string(),
  grantId: z.string().optional(),
  submissionId: z.string().optional(),
  type: z.enum(['other', 'report_due', 'progress_check', 'stipulation', 'next_steps']).optional(),
  title: z.string(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'overdue', 'completed']).optional(),
  completedAt: z.string().optional(),
});

const patchBodySchema = z.object({
  id: z.string(),
  grantId: z.string().optional(),
  submissionId: z.string().optional(),
  type: z.enum(['other', 'report_due', 'progress_check', 'stipulation', 'next_steps']).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'overdue', 'completed']).optional(),
  completedAt: z.string().optional(),
  createdAt: z.string().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
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
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get follow-ups'),
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const rawBody = await request.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('AGENT_INVALID_JSON', 'ID and title are required'),
        { status: 400 },
      );
    }
    const body = parsed.data;

    const followUp = await submissionService.createFollowUp({
      id: body.id,
      ...(body.grantId ? { grantId: body.grantId } : {}),
      ...(body.submissionId ? { submissionId: body.submissionId } : {}),
      type: body.type || 'other',
      title: body.title,
      ...(body.description ? { description: body.description } : {}),
      ...(body.dueDate ? { dueDate: body.dueDate } : {}),
      status: body.status || 'pending',
      ...(body.completedAt ? { completedAt: body.completedAt } : {}),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(followUp, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error creating follow-up');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create follow-up'),
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid follow-up data'), {
        status: 400,
      });
    }

    const data = parsed.data;
    const update = {
      id: data.id,
      type: data.type || 'other',
      title: data.title || '',
      status: data.status || 'pending',
      createdAt: data.createdAt || new Date().toISOString(),
      ...(data.grantId !== undefined ? { grantId: data.grantId } : {}),
      ...(data.submissionId !== undefined ? { submissionId: data.submissionId } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
    };
    await submissionService.updateFollowUp(update);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error updating follow-up');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to update follow-up'),
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        createErrorResponse('AGENT_INVALID_JSON', 'Follow-up ID is required'),
        { status: 400 },
      );
    }

    const deleted = await submissionService.deleteFollowUp(id);

    if (!deleted) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Follow-up not found'), {
        status: 404,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting follow-up');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to delete follow-up'),
      { status: 500 },
    );
  }
}
