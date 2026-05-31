import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get('grantId') ?? undefined;
    const deps = getDependencies();
    return NextResponse.json(await deps.repository.getConflictRecords(grantId));
  } catch (error) {
    logger.error({ err: error }, 'Error listing conflicts');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to list conflicts'), { status: 500 });
  }
}
