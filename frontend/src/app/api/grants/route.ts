import { type NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
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
	await connection();
	try {
		const deps = getDependencies();
		const { searchParams } = new URL(request.url);

		const search = searchParams.get("search");
		const status = searchParams.get("status");
		const funderType = searchParams.get("funderType");
		const minFit = searchParams.get("minFit");
		const maxDeadline = searchParams.get("maxDeadline");
		const sortBy = searchParams.get("sortBy") || "fit";

		let grants: Grant[];

		if (search) {
			// FTS5 search with bm25 ranking
			const { getSqliteState, openDatabase } = await import('../../../../../shared/grant-ops-sqlite');
			const state = getSqliteState();
			const db = openDatabase(state);

			// Parse query into OR-separated quoted terms with trailing wildcard
			const terms = search.trim().split(/\s+/).filter(Boolean);
			const ftsQuery = terms.map((t) => `"${t}"*`).join(' OR ');

			const sql = `
				SELECT g.* FROM grants_fts fts
				JOIN grants_v2 g ON fts.grantId = g.id
				WHERE grants_fts MATCH ? AND g.deletedAt IS NULL
				ORDER BY bm25(grants_fts)
				LIMIT 500
			`;
			const rows = db.prepare(sql).all(ftsQuery) as Array<Record<string, unknown>>;

			grants = rows.map((row) => ({
				id: String(row.id),
				title: String(row.title),
				funder: String(row.funder),
				funderShort: String(row.funderShort || ''),
				award: String(row.award || ''),
				awardSort: Number(row.awardSort || 0),
				deadline: String(row.deadline || ''),
				deadlineConfidence: (row.deadlineConfidence as Grant['deadlineConfidence']) || 'unknown',
				daysOut: 0,
				fit: Number(row.fitScore || 0),
				tags: JSON.parse(String(row.tags || '[]')) as string[],
				status: String(row.status) as Grant['status'],
				statusLabel: String(row.status),
				eligibility: String(row.eligibility || ''),
				externalUrl: String(row.externalUrl || ''),
				summary: String(row.summary || ''),
				category: String(row.category || ''),
				matchedAt: String(row.matchedAt || ''),
				createdAt: String(row.createdAt || ''),
				updatedAt: String(row.updatedAt || ''),
				deletedAt: row.deletedAt ? String(row.deletedAt) : undefined,
				grantType: 'crawled',
				checklist: [],
			}));
		} else {
			grants = await deps.repository.getGrants();
		}

		// Apply column filters (intersection with search results)
		let filtered = grants.filter((g) => !('deletedAt' in g) || g.deletedAt === undefined);

		if (status) {
			filtered = filtered.filter((g) => g.status === status);
		}
		if (funderType) {
			filtered = filtered.filter((g) => g.category === funderType || g.funder?.toLowerCase().includes(funderType.toLowerCase()));
		}
		if (minFit) {
			const min = Number(minFit);
			filtered = filtered.filter((g) => (g.fit || 0) >= min);
		}
		if (maxDeadline) {
			const max = new Date(maxDeadline);
			filtered = filtered.filter((g) => {
				if (!g.deadline || g.deadline === 'Rolling') return true;
				const dl = new Date(g.deadline);
				return !isNaN(dl.getTime()) && dl <= max;
			});
		}

		const sortedGrants = [...filtered].sort((a, b) => {
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

		return NextResponse.json({ grants: sortedGrants });
	} catch (error) {
		logger.error({ err: error }, 'Error getting grants');
		return NextResponse.json(
			{ error: "Failed to get grants", code: "DB_ERROR" },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	await connection();
	try {
		const body = await request.json().catch(() => null);
		const parsed = manualGrantSchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid grant payload'), { status: 400 });
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
		logger.error({ err: error }, 'Error creating grant');
		return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create grant'), { status: 500 });
	}
}

function parseAwardSort(award?: string): number {
  if (!award || award === '\u2014') return 0;
  const cleaned = award.replace(/[$,]/g, '').trim();
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? Math.round(num) : 0;
}
