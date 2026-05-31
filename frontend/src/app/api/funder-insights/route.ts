import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from "@/lib/api-error-handler";
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => ({}));
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('fi');
    return NextResponse.json({ jobId, funderId: body.funderId, message: 'Funder insights job queued' }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start funder insights';
    logger.error({ err: error }, 'Error starting funder insights');
    return NextResponse.json(
      createErrorResponse('AGENT_TIMEOUT', message),
      { status: 500 }
    );
  }
}
