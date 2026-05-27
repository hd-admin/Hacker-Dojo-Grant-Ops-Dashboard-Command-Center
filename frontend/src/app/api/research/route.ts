import { NextRequest, NextResponse } from 'next/server';
import * as researchService from '@/server/grant-ops/research-service';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { enqueueJob } from '@/server/grant-ops/job-queue-service';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  try {
    const deps = getDependencies();
    const profile = await deps.repository.getOrgProfile();

    if (!profile) {
      return NextResponse.json(
        { error: 'Organization profile not configured. Please set up your profile in Settings.' },
        { status: 400 },
      );
    }

    const settings = await deps.repository.getOpencodeSettings();
    if (!settings?.isConfigured) {
      return NextResponse.json(
        { error: 'Opencode is not configured. Please set up Opencode settings in the application before running research.' },
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
    console.error('Error running research:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to run research';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    const latestRun = await researchService.getLatestCrawlRun();
    const allRuns = await researchService.getCrawlRuns();

    return NextResponse.json({
      latestRun,
      allRuns,
    });
  } catch (error) {
    console.error('Error getting crawl runs:', error);
    return NextResponse.json({ error: 'Failed to get crawl runs' }, { status: 500 });
  }
}
