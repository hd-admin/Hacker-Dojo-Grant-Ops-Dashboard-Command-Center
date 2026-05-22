import { NextRequest, NextResponse } from 'next/server';
import * as researchService from '@/server/grant-ops/research-service';
import * as repository from '@/server/grant-ops/repository';

export async function POST(_request: NextRequest) {
  try {
    // Get organization profile
    const profile = await repository.getOrgProfile();

    if (!profile) {
      return NextResponse.json(
        { error: 'Organization profile not configured. Please set up your profile in Settings.' },
        { status: 400 },
      );
    }

    // Check if Opencode is configured
    const settings = await repository.getOpencodeSettings();
    const useOpencode = settings?.isConfigured ?? false;
    const provider = useOpencode ? 'cli' : 'fake';

    // Run research
    const result = await researchService.runResearch(profile, {
      useOpencode,
      opencodeProvider: provider,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error running research:', error);
    return NextResponse.json(
      { error: 'Failed to run research' },
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
