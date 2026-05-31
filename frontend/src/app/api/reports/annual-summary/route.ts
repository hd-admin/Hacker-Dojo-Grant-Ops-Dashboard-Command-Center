import { NextResponse, connection } from "next/server";
import { getGrants } from "@/server/grant-ops/repository";
import { generateAnnualSummary } from "@/server/grant-ops/dashboard-service";
import { logger } from "@/lib/logger";
import { createErrorResponse } from "@/lib/api-error-handler";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await connection();
  try {
    const grants = await getGrants();
    const summary = generateAnnualSummary(grants);

    return NextResponse.json(summary);
  } catch (error) {
    logger.error({ err: error }, "Error generating annual summary");
    return NextResponse.json(
      createErrorResponse("STORAGE_UNAVAILABLE", "Failed to generate annual summary"),
      { status: 500 }
    );
  }
}
