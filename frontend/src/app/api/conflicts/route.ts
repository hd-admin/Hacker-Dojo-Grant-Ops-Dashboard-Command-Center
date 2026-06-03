import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  grantId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    const parsed = querySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters'),
        { status: 400 },
      );
    }
    const grantId = parsed.data.grantId;
    const deps = getDependencies();
    return NextResponse.json(await deps.repository.getConflictRecords(grantId));
  } catch (error) {
    logger.error({ err: error }, 'Error listing conflicts');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to list conflicts'),
      { status: 500 },
    );
  }
}
