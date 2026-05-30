/**
 * GET /api/grants/export
 * Export grants as CSV for backup/sharing.
 * Query params:
 *   - view: 'discovery' | 'pipeline' (default: 'discovery')
 *   - status: optional grant status filter
 *   - fit: optional minimum fit threshold
 *   - category: optional category filter
 *   - daysOut: optional maximum days-out filter
 *   - deadlineConfidence: optional deadline confidence filter (exact/estimated/rolling/unknown)
 *   - funderType: optional funder type filter
 */

import { NextRequest, NextResponse } from "next/server";

import { getDependencies } from "@/server/grant-ops/dependencies";
import { exportGrantsToCsv, exportPipelineToCsv } from "@/server/grant-ops/dashboard-service";
import type { Grant } from "../../../../../../shared/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "discovery";
  const status = searchParams.get("status") ?? undefined;
  const fitMin = searchParams.get("fit") ? Number(searchParams.get("fit")) : undefined;
  const category = searchParams.get("category") ?? undefined;
  const daysOutMax = searchParams.get("daysOut") ? Number(searchParams.get("daysOut")) : undefined;
  const deadlineConfidence = searchParams.get("deadlineConfidence") ?? undefined;
  const funderType = searchParams.get("funderType") ?? undefined;

  try {
    const { repository } = getDependencies();
    let grants = await repository.getGrants();

    if (status) grants = grants.filter((g) => g.status === status);
    if (fitMin != null && !Number.isNaN(fitMin)) grants = grants.filter((g) => g.fit >= fitMin);
    if (category) grants = grants.filter((g) => g.tags.some((t) => t.toLowerCase() === category.toLowerCase() || t.toLowerCase().includes(category.toLowerCase())));
    if (daysOutMax != null && !Number.isNaN(daysOutMax)) grants = grants.filter((g) => g.daysOut <= daysOutMax);
    if (deadlineConfidence) grants = grants.filter((g) => g.deadlineConfidence === deadlineConfidence);
    if (funderType) grants = grants.filter((g) => g.tags.includes(funderType));

    const sortedGrants = [...grants].sort((a, b) => {
      if (view === "pipeline") {
        const matchedAtDiff = new Date(b.matchedAt ?? 0).getTime() - new Date(a.matchedAt ?? 0).getTime();
        if (matchedAtDiff !== 0) return matchedAtDiff;
        return a.daysOut - b.daysOut;
      }

      return new Date(b.matchedAt ?? 0).getTime() - new Date(a.matchedAt ?? 0).getTime();
    });

    const csvExport = view === "pipeline"
      ? exportPipelineToCsv(sortedGrants as Grant[])
      : exportGrantsToCsv(sortedGrants as Grant[]);

    const csvLines = [
      csvExport.headers.join(","),
      ...csvExport.rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ];
    const csvContent = csvLines.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${csvExport.filename}"`,
      },
    });
  } catch (error) {
    console.error("[grants/export] Failed to export grants:", error);
    return NextResponse.json(
      { error: "Failed to export grants" },
      { status: 500 }
    );
  }
}
