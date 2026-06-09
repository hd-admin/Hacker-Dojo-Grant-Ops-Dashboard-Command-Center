import { type NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { getProfile, isSubmissionReady } from '@/server/grant-ops/profile-service';
import type { GrantStatus } from '../../../../../../../shared/types';
import {
  validateTransition,
  checkSubmissionReadiness,
} from '../../../../../../../shared/pipeline-logic';

export const dynamic = 'force-dynamic';

const statusSchema = z.object({
  status: z.enum([
    'matched',
    'draft',
    'review',
    'approved',
    'submission-ready',
    'submitted',
    'follow-up',
    'awarded',
    'declined',
    'closed',
    'archived',
  ]),
  statusLabel: z.string(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
): Promise<NextResponse> {
  return updateStatus(request, params);
}

/**
 * POST is exported as an alias for PATCH so the PipelineView client
 * (which historically uses fetch with method: 'POST' for the
 * move-menu and decline workflows) is reconciled with the
 * server-side PATCH handler. The two methods share the same
 * implementation; the regression test in
 * frontend/src/app/api/grants/[grantId]/status/route.test.ts locks
 * in that POST and PATCH are both accepted.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
): Promise<NextResponse> {
  return updateStatus(request, params);
}

async function updateStatus(
  request: NextRequest,
  params: Promise<{ grantId: string }>,
): Promise<NextResponse> {
  await connection();
  try {
    const { grantId } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid grant status payload',
          code: 'VALIDATION_ERROR',
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const deps = getDependencies();
    const existingGrant = await deps.repository.getGrant(grantId);
    if (!existingGrant) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Grant not found'), {
        status: 404,
      });
    }

    const targetStatus = parsed.data.status as GrantStatus;
    const fromStatus = existingGrant.status as GrantStatus;

    const transitionResult = validateTransition(fromStatus, targetStatus);
    if (!transitionResult.valid) {
      return NextResponse.json(
        {
          error:
            transitionResult.reason ?? `Cannot transition from ${fromStatus} to ${targetStatus}`,
          code: 'INVALID_STATE_TRANSITION',
          details: {
            from: fromStatus,
            to: targetStatus,
          },
        },
        { status: 400 },
      );
    }

    if (targetStatus === 'submission-ready') {
      const profile = await getProfile();
      const profileResult = await isSubmissionReady(profile);
      const readiness = checkSubmissionReadiness(existingGrant, profileResult.ready);
      if (!readiness.ready) {
        return NextResponse.json(
          {
            error: `Cannot transition to submission-ready: ${readiness.blockingReasons.join('; ')}`,
            code: 'SUBMISSION_BLOCKED',
            details: {
              blockingReasons: readiness.blockingReasons,
            },
          },
          { status: 400 },
        );
      }
    }

    const previousStatus = existingGrant.status;
    const archivedAt = new Date().toISOString();
    const statusUpdates: Record<string, unknown> = {
      status: targetStatus,
      statusLabel: parsed.data.statusLabel,
    };
    if (targetStatus === 'archived') {
      statusUpdates.archivedAt = archivedAt;
    } else if (previousStatus === 'archived') {
      statusUpdates.archivedAt = undefined;
    }
    await deps.repository.updateGrant(grantId, statusUpdates);

    // Insert pipeline transition audit log
    await deps.repository.createPipelineTransition({
      id: `${grantId}-transition-${Date.now()}`,
      grantId,
      fromState: previousStatus,
      toState: targetStatus,
      actor: 'system',
      timestamp: archivedAt,
      reason: `Transitioned via API from ${previousStatus} to ${targetStatus}`,
    });

    await deps.repository.addAuditEvent({
      id: `${grantId}-status-${Date.now()}`,
      eventType: 'grant_status_changed',
      entityId: grantId,
      entityType: 'grant',
      actorLabel: 'system',
      timestamp: archivedAt,
      metadata: {
        from: previousStatus,
        to: parsed.data.status,
        archivedAt: targetStatus === 'archived' ? archivedAt : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error updating grant status');
    return NextResponse.json(
      { error: 'Failed to update grant status', code: 'DB_INTEGRITY_ERROR' },
      { status: 500 },
    );
  }
}
