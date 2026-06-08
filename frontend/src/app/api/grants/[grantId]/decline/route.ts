import { type NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { validateTransition } from '../../../../../../../shared/pipeline-logic';

export const dynamic = 'force-dynamic';

const declineSchema = z.object({
  lessonsLearned: z
    .string({ required_error: 'lessonsLearned is required' })
    .min(1, 'lessonsLearned must be a non-empty string'),
  statusLabel: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
): Promise<NextResponse> {
  await connection();
  try {
    const { grantId } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Request body must be a JSON object'),
        { status: 400 },
      );
    }

    const parsed = declineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid decline payload: lessonsLearned is required and must be a non-empty string',
          { validationErrors: parsed.error.format() },
        ),
        { status: 400 },
      );
    }

    const { lessonsLearned, statusLabel } = parsed.data;
    const deps = getDependencies();
    const existingGrant = await deps.repository.getGrant(grantId);
    if (!existingGrant) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Grant not found'), {
        status: 404,
      });
    }

    const fromStatus = existingGrant.status;
    const transitionResult = validateTransition(fromStatus, 'declined');
    if (!transitionResult.valid) {
      return NextResponse.json(
        {
          error:
            transitionResult.reason ?? `Cannot transition from ${fromStatus} to declined`,
          code: 'INVALID_STATE_TRANSITION',
          details: { from: fromStatus, to: 'declined' },
        },
        { status: 400 },
      );
    }

    const previousStatus = existingGrant.status;
    const idGenerator = deps.idGenerator;
    const clock = deps.clock;
    const timestamp = clock.now().toISOString();

    await deps.repository.updateGrant(grantId, {
      status: 'declined',
      statusLabel: statusLabel ?? 'Declined',
      lessonsLearned,
    });

    await deps.repository.createPipelineTransition?.({
      id: idGenerator.generateId('transition'),
      grantId,
      fromState: previousStatus,
      toState: 'declined',
      actor: 'operator',
      timestamp,
      reason: `Declined: ${lessonsLearned}`,
    });

    await deps.repository.addAuditEvent({
      id: idGenerator.generateId('audit'),
      eventType: 'grant_declined',
      entityId: grantId,
      entityType: 'grant',
      actorLabel: 'operator',
      timestamp,
      metadata: { lessonsLearned },
    });

    return NextResponse.json(
      {
        success: true,
        grantId,
        status: 'declined',
        lessonsLearned,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, 'Error declining grant');
    return NextResponse.json(
      createErrorResponse('DB_INTEGRITY_ERROR', 'Failed to decline grant'),
      { status: 500 },
    );
  }
}
