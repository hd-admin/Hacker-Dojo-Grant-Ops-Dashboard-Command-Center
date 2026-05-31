import { NextResponse, connection } from "next/server";
import { getGrants } from "@/server/grant-ops/repository";
import { generateFundraisingForecast } from "@/server/grant-ops/dashboard-service";
import { logger } from "@/lib/logger";
import { createErrorResponse } from "@/lib/api-error-handler";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await connection();
  try {
    const grants = await getGrants();
    const forecast = generateFundraisingForecast(grants);

    return NextResponse.json({
      projectedSubmissions90d: forecast.projectedSubmissions90d,
      projectedAwardValue: forecast.projectedAwardValue,
      atRiskGrantCount: forecast.atRiskGrants.length,
      atRiskGrants: forecast.atRiskGrants.map((g) => ({
        id: g.id,
        title: g.title,
        funder: g.funder,
        deadline: g.deadline,
        daysOut: g.daysOut,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "Error generating fundraising forecast");
    return NextResponse.json(
      createErrorResponse("STORAGE_UNAVAILABLE", "Failed to generate forecast"),
      { status: 500 }
    );
  }
}
