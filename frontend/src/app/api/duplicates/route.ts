import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.string().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
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
    const status = parsed.data.status;
    const deps = getDependencies();
    const duplicates = await deps.repository.getDuplicateCandidates(status);
    return NextResponse.json(duplicates);
  } catch (error) {
    logger.error({ err: error }, 'Error listing duplicates');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to list duplicates'),
      { status: 500 },
    );
  }
}
