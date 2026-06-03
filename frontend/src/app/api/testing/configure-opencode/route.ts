import { NextResponse, connection } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const configureSchema = z.object({
  binaryPath: z.string().min(1, 'binaryPath is required'),
  workingDirectory: z.string().min(1, 'workingDirectory is required'),
  timeoutMs: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    await connection();
    const body = await request.json().catch(() => null);
    const parsed = configureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid configure-opencode payload', {
          validationErrors: parsed.error.format(),
        }),
        { status: 400 },
      );
    }

    const deps = getDependencies();
    await deps.repository.updateOpencodeSettings({
      binaryPath: parsed.data.binaryPath,
      workingDirectory: parsed.data.workingDirectory,
      timeoutMs: parsed.data.timeoutMs ?? 60000,
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
