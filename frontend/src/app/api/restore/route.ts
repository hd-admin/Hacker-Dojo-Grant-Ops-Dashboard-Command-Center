import { NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.record(z.unknown());

export async function POST(request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const rawBody = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid backup payload'), { status: 400 });
    }
    await deps.backup.importBackupSnapshot(parsed.data as never);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error restoring backup');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to restore backup'), { status: 500 });
  }
}
