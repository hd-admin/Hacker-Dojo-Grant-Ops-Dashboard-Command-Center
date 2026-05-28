/**
 * GET /api/grants/export
 * Export grants as CSV for backup/sharing.
 * Query params:
 *   - view: 'discovery' | 'pipeline' (default: 'discovery')
 *   - status: optional grant status filter
 */

import { NextRequest, NextResponse } from "next/server";

import { getDependencies } from "../../../server/grant-ops/dependencies";
import { exportGrantsToCsv, exportPipelineToCsv } from "../../../server/grant-ops/dashboard-service";
import type { Grant } from "../../../../../shared/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "discovery";
  const status = searchParams.get("status") ?? undefined;

  try {
    const { repository } = getDependencies();
    const grants = (await repository.getGrants()).filter((grant) => !status || grant.status === status);

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
