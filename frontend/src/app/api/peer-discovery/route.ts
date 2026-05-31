import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from "@/lib/api-error-handler";
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('peer');
    return NextResponse.json({ jobId, message: 'Peer discovery job queued' }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start peer discovery';
    return NextResponse.json(
      createErrorResponse('AGENT_TIMEOUT', message),
      { status: 500 }
    );
  }
}
