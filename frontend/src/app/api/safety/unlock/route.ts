import { type NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { attemptUnlock } from "@/server/grant-ops/safety-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.passcode !== "string" || body.passcode.length === 0) {
      return NextResponse.json({ success: false, error: "Passcode is required" }, { status: 400 });
    }

    const result = await attemptUnlock(body.passcode);

    if (result.success) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({
      success: false,
      error: result.reason || "Incorrect passcode",
    }, { status: 401 });
  } catch (error) {
    logger.error({ err: error }, 'Error unlocking');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to process unlock request'), { status: 500 });
  }
}
