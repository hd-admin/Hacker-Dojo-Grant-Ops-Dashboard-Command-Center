import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import * as submissionService from '@/server/grant-ops/submission-service';
import type { SubmissionInput } from '@/server/grant-ops/submission-service';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  method: z.object({
    type: z.enum(['other', 'portal', 'email', 'mail']),
    submittedBy: z.string().optional(),
    portalUrl: z.string().optional(),
    confirmationId: z.string().optional(),
  }),
  notes: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  await connection();
  try {
    const { grantId } = await params;
    const submission = await submissionService.getSubmissionRecord(grantId);
    return NextResponse.json(submission);
  } catch (error) {
    logger.error({ err: error }, 'Error getting submission');
    return NextResponse.json({ error: 'Failed to get submission', failureCategory: 'unknown' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  await connection();
  try {
    const { grantId } = await params;
    const rawBody = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid request body'), { status: 400 });
    }
    const body = parsed.data;
    const deps = getDependencies();

    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Grant not found'), { status: 404 });
    }

    const method: SubmissionInput['method'] = {
      type: body.method.type,
      submittedBy: typeof body.method.submittedBy === 'string' ? body.method.submittedBy : 'human',
    };
    if (typeof body.method.portalUrl === 'string') method.portalUrl = body.method.portalUrl;
    if (typeof body.method.confirmationId === 'string') method.confirmationId = body.method.confirmationId;
    const submissionInput: SubmissionInput = {
      grant,
      method,
      submittedBy: typeof body.method.submittedBy === 'string' ? body.method.submittedBy : 'human',
    };
    if (typeof body.notes === 'string') submissionInput.notes = body.notes;
    const result = await submissionService.recordSubmission(submissionInput);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to record submission' }, { status: 400 });
    }

    return NextResponse.json({ success: true, submissionRecord: result.submissionRecord, followUps: result.followUps }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error recording submission');
    return NextResponse.json({ error: 'Failed to record submission', failureCategory: 'unknown' }, { status: 500 });
  }
}
