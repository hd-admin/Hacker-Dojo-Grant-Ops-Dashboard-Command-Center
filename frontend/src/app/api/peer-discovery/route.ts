import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from "@/lib/api-error-handler";
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  sourceUrl: z.string().optional(),
}).optional();

export async function POST(request: NextRequest) {
  await connection();
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid request body'), { status: 400 });
    }
    const _body = parsed.data;
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('peer');
    return NextResponse.json({ jobId, message: 'Peer discovery job queued' }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start peer discovery';
    logger.error({ err: error }, 'Error starting peer discovery');
    return NextResponse.json(
      createErrorResponse('AGENT_TIMEOUT', message),
      { status: 500 }
    );
  }
}
