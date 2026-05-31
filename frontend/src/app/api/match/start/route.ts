import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from "@/lib/api-error-handler";
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => ({}));
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('match');
    return NextResponse.json({ jobId, grantIds: body.grantIds || [], message: 'Match scoring job queued' }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start match scoring';
    return NextResponse.json(
      createErrorResponse('AGENT_TIMEOUT', message),
      { status: 500 }
    );
  }
}
