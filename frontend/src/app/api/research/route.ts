import { NextRequest, NextResponse } from 'next/server';
import * as researchService from '@/server/grant-ops/research-service';
import { getDependencies } from '@/server/grant-ops/dependencies';
export const dynamic = 'force-dynamic';


export async function POST(_request: NextRequest) {
  try {
    const deps = getDependencies();

    // Get organization profile
    const profile = await deps.repository.getOrgProfile();

    if (!profile) {
      return NextResponse.json(
        { error: 'Organization profile not configured. Please set up your profile in Settings.' },
        { status: 400 },
      );
    }

    // Check if Opencode is configured - runResearch will fail explicitly if not configured
    const settings = await deps.repository.getOpencodeSettings();
    if (!settings?.isConfigured) {
      return NextResponse.json(
        { error: 'Opencode is not configured. Please set up Opencode settings in the application before running research.' },
        { status: 400 },
      );
    }

    // Run research - will fail explicitly if Opencode is not properly configured
    const result = await researchService.runResearch(profile);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error running research:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to run research';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
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
    return NextResponse.json(
      { error: 'Failed to get crawl runs' },
      { status: 500 },
    );
  }
}
