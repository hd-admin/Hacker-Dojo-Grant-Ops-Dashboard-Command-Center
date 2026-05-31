import { NextResponse } from "next/server";
import { getGrants } from "@/server/grant-ops/repository";
import { generatePipelineReport } from "@/server/grant-ops/dashboard-service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const grants = await getGrants();
    const report = generatePipelineReport(grants);

    const headers = [
      "title",
      "funder",
      "status",
      "deadline",
      "awardAmount",
      "daysOut",
      "responsibilityTag",
    ];

    const csvRows = [
      headers.join(","),
      ...report.map((row) =>
        [
          `"${row.title.replace(/"/g, '""')}"`,
          `"${row.funder.replace(/"/g, '""')}"`,
          row.status,
          row.deadline,
          row.awardAmount,
          row.daysOut,
          row.responsibilityTag,
        ].join(",")
      ),
    ];

    const csv = csvRows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="pipeline-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error generating pipeline report");
    return NextResponse.json(
      { error: "Failed to generate pipeline report" },
      { status: 500 }
    );
  }
}
