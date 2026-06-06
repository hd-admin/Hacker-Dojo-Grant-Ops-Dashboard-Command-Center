import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { enqueueJob } from '@/server/grant-ops/job-queue-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  documentRef: z.string().optional(),
  grantId: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid request body'), {
        status: 400,
      });
    }
    const body = parsed.data;
    const deps = getDependencies();
    const profile = await deps.repository.getOrgProfile();
    if (!profile) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Organization profile not configured'),
        { status: 400 },
      );
    }
    const settings = await deps.repository.getOpencodeSettings();
    if (!settings?.isConfigured) {
      return NextResponse.json(
        createErrorResponse('OPENCODE_NOT_CONFIGURED', 'Opencode is not configured'),
        { status: 400 },
      );
    }

    const job = await enqueueJob(
      { jobType: 'extract', entityId: body.grantId || 'unknown', retryCount: 0 },
      'extracting',
      async () => {
        // Simulate document extraction - in production this would use the agent loop
        return `Extracted award data from ${body.documentRef || 'document'}`;
      },
    );

    return NextResponse.json(
      {
        jobId: job.id,
        documentRef: body.documentRef,
        grantId: body.grantId,
        message: 'Extract job queued',
      },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start extraction';
    logger.error({ err: error }, 'Error starting extraction');
    return NextResponse.json(createErrorResponse('AGENT_TIMEOUT', message), { status: 500 });
  }
}
