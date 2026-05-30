import { type NextRequest, NextResponse } from "next/server";
import { attemptUnlock } from "@/server/grant-ops/safety-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
    console.error("Error unlocking:", error);
    return NextResponse.json({ error: "Failed to process unlock request" }, { status: 500 });
  }
}
