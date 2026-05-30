import { type NextRequest, NextResponse } from "next/server";
import { setPasscode, isPasscodeSet, getLockConfig } from "@/server/grant-ops/safety-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (isPasscodeSet()) {
      return NextResponse.json({
        success: true,
        locked: true,
        message: "App is already locked",
      });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.passcode !== "string" || body.passcode.length === 0) {
      return NextResponse.json(
        { success: false, error: "A passcode is required to enable locking" },
        { status: 400 },
      );
    }

    await setPasscode(body.passcode);

    const config = getLockConfig();
    return NextResponse.json({
      success: true,
      locked: true,
      config: { ...config, enabled: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
