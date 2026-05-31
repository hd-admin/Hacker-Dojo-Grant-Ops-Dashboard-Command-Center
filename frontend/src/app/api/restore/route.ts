import { NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid backup payload'), { status: 400 });
    }
    await deps.backup.importBackupSnapshot(body as never);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error restoring backup');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to restore backup'), { status: 500 });
  }
}
