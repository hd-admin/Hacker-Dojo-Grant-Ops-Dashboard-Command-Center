import { connection } from 'next/server';
import { logger } from '@/lib/logger';
import { createErrorResponse } from '@/lib/api-error-handler';
import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ grantId: string }> }
) {
  await connection();
  try {
    const { grantId } = await params;
    const deps = getDependencies();
    const history = await deps.repository.getPipelineTransitionsByGrantId(grantId);
    return NextResponse.json({
      grantId,
      history,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting grant history');
    return NextResponse.json(
      createErrorResponse('DB_INTEGRITY_ERROR', 'Failed to get transition history'),
      { status: 500 },
    );
  }
}
