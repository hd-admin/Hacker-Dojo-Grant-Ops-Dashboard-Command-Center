import { NextResponse, connection } from "next/server";
import { computeBudgetVsActual } from "@/server/grant-ops/award-service";
import { createErrorResponse } from "@/lib/api-error-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ awardId: string }> }
): Promise<Response> {
  await connection();
  try {
    const { awardId } = await params;
    const rows = await computeBudgetVsActual(awardId);
    return NextResponse.json({ rows });
  } catch (error) {
    logger.error({ err: error }, "Error computing budget vs actual");
    return NextResponse.json(
      createErrorResponse("STORAGE_UNAVAILABLE", "Failed to compute budget vs actual"),
      { status: 500 }
    );
  }
}
