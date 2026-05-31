import { NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connection();
  try {
    const deps = getDependencies();
    return NextResponse.json(await deps.loadBackupFreshness());
  } catch (error) {
    logger.error({ err: error }, 'Error loading backup freshness');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to load backup freshness'), { status: 500 });
  }
}
