import { NextResponse } from "next/server";
import { getComplianceCalendar } from "@/server/grant-ops/award-service";
import { createErrorResponse } from "@/lib/api-error-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const events = await getComplianceCalendar();
    return NextResponse.json({ events });
  } catch (error) {
    logger.error({ err: error }, "Error getting compliance calendar");
    return NextResponse.json(
      createErrorResponse("STORAGE_UNAVAILABLE", "Failed to get compliance calendar"),
      { status: 500 }
    );
  }
}
