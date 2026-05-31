import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const deps = getDependencies();
    const duplicates = await deps.repository.getDuplicateCandidates(status);
    return NextResponse.json(duplicates);
  } catch (error) {
    logger.error({ err: error }, 'Error listing duplicates');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to list duplicates'), { status: 500 });
  }
}
