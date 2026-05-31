import { type NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from "zod";
import { getDependencies } from "@/server/grant-ops/dependencies";
import type { GrantStatus } from "../../../../../../../shared/types";
import { validateTransition, checkSubmissionReadiness } from "../../../../../../../shared/pipeline-logic";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
	status: z.enum(["matched", "draft", "review", "approved", "submission-ready", "submitted", "follow-up", "awarded", "declined", "closed", "archived"]),
	statusLabel: z.string(),
});

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ grantId: string }> },
) {
  await connection();
	try {
		const { grantId } = await params;
		const body = await request.json().catch(() => null);

		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return NextResponse.json(
				{ error: "Request body must be a JSON object" },
				{ status: 400 },
			);
		}

		const parsed = statusSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{
					error: "Invalid grant status payload",
					issues: parsed.error.flatten(),
				},
				{ status: 400 },
			);
		}

		const deps = getDependencies();
		const existingGrant = await deps.repository.getGrant(grantId);
		if (!existingGrant) {
			return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Grant not found'), { status: 404 });
		}

		const targetStatus = parsed.data.status as GrantStatus;
		const fromStatus = existingGrant.status as GrantStatus;

		const transitionResult = validateTransition(fromStatus, targetStatus);
		if (!transitionResult.valid) {
			return NextResponse.json(
				{
					error: transitionResult.reason ?? `Cannot transition from ${fromStatus} to ${targetStatus}`,
					code: "INVALID_STATE_TRANSITION",
					details: {
						from: fromStatus,
						to: targetStatus,
					},
				},
				{ status: 400 },
			);
		}

		if (targetStatus === "submission-ready") {
			const readiness = checkSubmissionReadiness(existingGrant);
			if (!readiness.ready) {
				return NextResponse.json(
					{
						error: `Cannot transition to submission-ready: ${readiness.blockingReasons.join('; ')}`,
						code: "SUBMISSION_BLOCKED",
						details: {
							blockingReasons: readiness.blockingReasons,
						},
					},
					{ status: 400 },
				);
			}
		}

		const previousStatus = existingGrant.status;
		await deps.repository.updateGrant(grantId, {
			status: targetStatus,
			statusLabel: parsed.data.statusLabel,
		});

		// Insert pipeline transition audit log
		await deps.repository.createPipelineTransition({
			id: `${grantId}-transition-${Date.now()}`,
			grantId,
			fromState: previousStatus,
			toState: targetStatus,
			actor: 'system',
			timestamp: new Date().toISOString(),
			reason: `Transitioned via API from ${previousStatus} to ${targetStatus}`,
		});

		await deps.repository.addAuditEvent({
			id: `${grantId}-status-${Date.now()}`,
			eventType: 'grant_status_changed',
			entityId: grantId,
			entityType: 'grant',
			actorLabel: 'system',
			timestamp: new Date().toISOString(),
			metadata: { from: previousStatus, to: parsed.data.status },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error({ err: error }, 'Error updating grant status');
		return NextResponse.json(
			{ error: "Failed to update grant status", code: "DB_INTEGRITY_ERROR" },
			{ status: 500 },
		);
	}
}
