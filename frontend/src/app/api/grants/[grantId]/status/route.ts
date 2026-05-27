import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDependencies } from "@/server/grant-ops/dependencies";
import type { GrantStatus } from "../../../../../../../shared/types";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
	status: z.enum(["matched", "draft", "review", "approved", "submission-ready", "submitted", "follow-up", "awarded", "declined", "closed", "archived"]),
	statusLabel: z.string(),
});

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ grantId: string }> },
) {
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
			return NextResponse.json({ error: "Grant not found" }, { status: 404 });
		}

		const previousStatus = existingGrant.status;
		await deps.repository.updateGrant(grantId, {
			status: parsed.data.status as GrantStatus,
			statusLabel: parsed.data.statusLabel,
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
		console.error("Error updating grant status:", error);
		return NextResponse.json(
			{ error: "Failed to update grant status" },
			{ status: 500 },
		);
	}
}
