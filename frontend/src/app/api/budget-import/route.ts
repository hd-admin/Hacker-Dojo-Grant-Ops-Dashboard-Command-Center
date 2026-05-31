import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from "@/lib/api-error-handler";
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  awardId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  await connection();
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid request body'), { status: 400 });
    }
    const body = parsed.data;
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('bi');
    return NextResponse.json({ jobId, awardId: body.awardId, message: 'Budget import job queued' }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start budget import';
    logger.error({ err: error }, 'Error starting budget import');
    return NextResponse.json(
      createErrorResponse('AGENT_TIMEOUT', message),
      { status: 500 }
    );
  }
}
