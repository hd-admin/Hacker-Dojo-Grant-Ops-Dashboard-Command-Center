import { NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { revalidateAfterMutation } from '@/lib/revalidate';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const _emptyBody = z.object({}).strict();

export async function POST() {
  try {
    await connection();
    const deps = getDependencies();
    await deps.resetPersistentStateForTests();
    revalidateAfterMutation();
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error resetting persistent state');
    return NextResponse.json(
      createErrorResponse('RESET_FAILED', 'Failed to reset persistent state'),
      { status: 500 },
    );
  }
}
