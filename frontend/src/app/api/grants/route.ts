import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDependencies } from "@/server/grant-ops/dependencies";
import type { Grant } from "../../../../../shared/types";
export const dynamic = 'force-dynamic';

const manualGrantSchema = z.object({
	title: z.string().min(1),
	funder: z.string().min(1),
	award: z.string().optional(),
	deadline: z.string().optional(),
	deadlineConfidence: z.enum(['exact', 'estimated', 'rolling', 'unknown']).optional(),
	tags: z.array(z.string()).optional(),
	notes: z.string().optional(),
	eligibility: z.string().optional(),
});

export async function GET(request: NextRequest) {
	try {
		const deps = getDependencies();
		const grants = await deps.repository.getGrants();

		const { searchParams } = new URL(request.url);
		const sortBy = searchParams.get("sortBy") || "fit";

		const sortedGrants = [...grants].sort((a, b) => {
			switch (sortBy) {
				case "fit":
					return (b.fit || 0) - (a.fit || 0);
				case "deadline":
					if (a.deadline === "Rolling") return 1;
					if (b.deadline === "Rolling") return -1;
					return (a.daysOut || 999) - (b.daysOut || 999);
				case "award":
					return (b.awardSort || 0) - (a.awardSort || 0);
				default:
					return (b.fit || 0) - (a.fit || 0);
			}
		});

		return NextResponse.json(sortedGrants);
	} catch (error) {
		console.error("Error getting grants:", error);
		return NextResponse.json(
			{ error: "Failed to get grants" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json().catch(() => null);
		const parsed = manualGrantSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json({ error: 'Invalid grant payload' }, { status: 400 });
		}

		const deps = getDependencies();
		const now = new Date().toISOString();

		let daysOut = 0;
		if (parsed.data.deadline && parsed.data.deadline !== 'Rolling') {
			const dl = new Date(parsed.data.deadline);
			const diffMs = dl.getTime() - new Date().getTime();
			daysOut = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
		}

		const grant: Grant = {
			id: deps.idGenerator.generateId('grant'),
			title: parsed.data.title,
			funder: parsed.data.funder,
			funderShort: parsed.data.funder.substring(0, 20),
			award: parsed.data.award ?? '\u2014',
			awardSort: parseAwardSort(parsed.data.award),
			deadline: parsed.data.deadline ?? 'Rolling',
			deadlineConfidence: parsed.data.deadlineConfidence ?? 'unknown',
			daysOut,
			fit: 60,
			tags: parsed.data.tags ?? [],
			status: 'matched',
			statusLabel: 'Matched',
			manualSource: true,
			manualOrigin: true,
			enteredAt: now,
			grantType: 'manual',
			matchedAt: now,
			checklist: [],
		};

		await deps.repository.addGrant(grant);
		await deps.repository.addAuditEvent({
			id: deps.idGenerator.generateId('audit'),
			eventType: 'match_created',
			entityId: grant.id,
			entityType: 'grant',
			actorLabel: 'manual-intake',
			timestamp: now,
			metadata: { source: 'manual', notes: parsed.data.notes ?? '' },
		});

		return NextResponse.json(grant, { status: 201 });
	} catch (error) {
		console.error('Error creating grant:', error);
		return NextResponse.json({ error: 'Failed to create grant' }, { status: 500 });
	}
}

function parseAwardSort(award?: string): number {
  if (!award || award === '\u2014') return 0;
  const cleaned = award.replace(/[$,]/g, '').trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? Math.round(num) : 0;
}
