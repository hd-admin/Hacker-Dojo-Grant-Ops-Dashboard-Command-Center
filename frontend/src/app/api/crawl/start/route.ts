import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { enqueueJob } from '@/server/grant-ops/job-queue-service';
import * as researchService from '@/server/grant-ops/research-service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  sourceId: z.string().optional(),
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
      { jobType: 'crawl', entityId: body.sourceId || 'all', retryCount: 0 },
      'fetching',
      async () => {
        const options: researchService.ResearchOptions = {};
        if (body.sourceId) {
          options.sourceIds = [body.sourceId];
        }
        const result = await researchService.runResearch(profile, options);
        if (!result.crawlRun || result.crawlRun.status === 'failed') {
          throw new Error(result.error || 'Crawl completed but crawlRun was not persisted');
        }
        return `Crawl completed: ${result.grantsMatched} grant(s) matched across ${result.crawlRun.sourcesCrawled} source(s)`;
      },
    );
    return NextResponse.json({ queued: true, job }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start crawl';
    logger.error({ err: error }, 'Error starting crawl');
    return NextResponse.json(createErrorResponse('AGENT_TIMEOUT', message), { status: 500 });
  }
}
