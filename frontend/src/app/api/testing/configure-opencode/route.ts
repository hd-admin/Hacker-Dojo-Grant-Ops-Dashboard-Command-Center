import { NextResponse, connection } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await connection();
    const deps = getDependencies();
    const body = await request.json().catch(() => ({}));
    const binaryPath = typeof body.binaryPath === 'string' ? body.binaryPath : '';
    const workingDirectory = typeof body.workingDirectory === 'string' ? body.workingDirectory : '';

    await deps.repository.updateOpencodeSettings({
      binaryPath,
      workingDirectory,
      timeoutMs: 60000,
      isConfigured: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error configuring opencode for tests');
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'Failed to configure opencode'),
      { status: 500 },
    );
  }
}
