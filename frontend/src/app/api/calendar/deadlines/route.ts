import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';

export async function GET(_request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const grants = await deps.repository.getGrants();
    const deadlines = grants
      .filter((g) => g.deadline && g.deadline !== 'Rolling')
      .map((g) => ({
        id: g.id,
        title: g.title,
        funder: g.funder,
        deadline: g.deadline,
        status: g.status,
        type: 'grant' as const,
      }));
    return NextResponse.json({ deadlines });
  } catch (error) {
    logger.error({ err: error }, 'Error getting deadlines');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get deadlines'), { status: 500 });
  }
}
