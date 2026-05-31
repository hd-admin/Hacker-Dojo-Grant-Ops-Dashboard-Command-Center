import type { NextRequest } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { NextResponse, connection } from "next/server";
import { opencodeFailureMessages } from '@/lib/failure-messages';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { enqueueJob } from '@/server/grant-ops/job-queue-service';
import { classifyOpencodeError } from '@/server/grant-ops/opencode-client';
import * as researchService from '@/server/grant-ops/research-service';
import { NoSourcesConfiguredError } from '@/server/grant-ops/research-service';
export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const profile = await deps.repository.getOrgProfile();

    if (!profile) {
      return NextResponse.json(
        {
          error: 'ORG_PROFILE_NOT_CONFIGURED',
          message: 'Organization profile not configured. Please set up your profile in Settings.',
        },
        { status: 400 },
      );
    }

    const settings = await deps.repository.getOpencodeSettings();
    if (!settings?.isConfigured) {
      return NextResponse.json(
        {
          error: 'OPENCODE_NOT_CONFIGURED',
          message: 'Opencode is not configured. Please set up Opencode settings in the application before running research.',
        },
        { status: 400 },
      );
    }

    const job = await enqueueJob(
      { jobType: 'research', entityId: profile.legalName, retryCount: 0 },
      'researching',
      async () => {
        const result = await researchService.runResearch(profile);
        if (!result.crawlRun || result.crawlRun.status === 'failed') {
          throw new Error(result.error || 'Research completed but crawlRun was not persisted');
        }
        return `Research completed: ${result.grantsMatched} grant(s) matched across ${result.crawlRun.sourcesCrawled} source(s)`;
      },
    );

    return NextResponse.json({
      queued: true,
      job,
    }, { status: 202 });
  } catch (error) {
    logger.error({ err: error }, 'Error running research');

    if (error instanceof NoSourcesConfiguredError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 409 },
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to run research';
    const failureMode = classifyOpencodeError(errorMessage);
    const guidance = opencodeFailureMessages[failureMode];
    const retryable = ['rate-limit', 'malformed-output', 'model-unavailable', 'timeout', 'unknown'].includes(failureMode);

    return NextResponse.json(
      {
        error: errorMessage,
        failureMode,
        retryable,
        guidance,
      },
      { status: 500 },
    );
  }
}

export async function GET(_request: NextRequest) {
  await connection();
  try {
    const latestRun = await researchService.getLatestCrawlRun();
    const allRuns = await researchService.getCrawlRuns();

    return NextResponse.json({
      latestRun,
      allRuns,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting crawl runs');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get crawl runs'), { status: 500 });
  }
}
