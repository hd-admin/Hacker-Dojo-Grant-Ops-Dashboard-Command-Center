import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { revalidateAfterMutation } from '@/lib/revalidate';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { enqueueJob } from '@/server/grant-ops/job-queue-service';
import * as discoveryServices from '@/server/grant-ops/discovery-services';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  grantId: z.string().optional(),
  requirements: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('AGENT_INVALID_JSON', 'Invalid request body'),
        { status: 400 },
      );
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

    const grantId = body.grantId || 'unknown-grant';
    const job = await enqueueJob(
      { jobType: 'eligibility-vetting', entityId: grantId, retryCount: 0 },
      'analyzing',
      async () => {
        const result = await discoveryServices.runEligibilityVetting(grantId);
        return `Eligibility vetting completed: ${result.artifact.status} — ${result.artifact.checks.length} check(s) evaluated`;
      },
    );

    revalidateAfterMutation();
    return NextResponse.json({ queued: true, job }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start eligibility vetting';
    logger.error({ err: error }, 'Error starting eligibility vetting');
    return NextResponse.json(createErrorResponse('AGENT_TIMEOUT', message), { status: 500 });
  }
}
