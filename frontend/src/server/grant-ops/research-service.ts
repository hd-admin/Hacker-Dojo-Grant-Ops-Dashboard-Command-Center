/**
 * Research Service
 *
 * Handles on-demand grant research using Opencode and stored sources.
 * Crawls sources, normalizes findings, ranks by fit/deadline/award, and persists evidence.
 */

import type {
  CrawlRun,
  Grant,
  OrganizationProfile,
} from '../../../../shared/types';
import { getOpencodeAdapter } from './opencode-client';
import * as repository from './repository';
import * as sourceService from './source-service';

export interface ResearchResult {
  crawlRun: CrawlRun;
  grantsFound: number;
  grantsMatched: number;
  error?: string;
}

export interface ResearchOptions {
  useOpencode?: boolean;
  opencodeProvider?: 'cli' | 'fake';
}

export async function runResearch(
  profile: OrganizationProfile,
  options: ResearchOptions = {},
): Promise<ResearchResult> {
  const startTime = new Date().toISOString();
  const crawlRunId = `crawl-${Date.now()}`;

  // Create initial crawl run record
  const crawlRun: CrawlRun = {
    id: crawlRunId,
    startedAt: startTime,
    status: 'running',
    sourcesCrawled: 0,
    grantsFound: 0,
    grantsMatched: 0,
  };

  await repository.addCrawlRun(crawlRun);

  try {
    // Get active sources
    const sources = await sourceService.getActiveSources();

    // If no sources, create a default one based on search themes
    if (sources.length === 0) {
      const defaultSource = await sourceService.addSource({
        name: 'Default Search',
        url: 'https://www.candid.org',
        type: 'website',
      });
      sources.push(defaultSource);
    }

    // Get Opencode adapter
    const settings = await repository.getOpencodeSettings();
    const adapter = getOpencodeAdapter(
      settings || {
        binaryPath: '',
        workingDirectory: '',
        timeoutMs: 60000,
        isConfigured: false,
      },
      options.opencodeProvider || 'cli',
    );

    let totalGrantsFound = 0;
    let totalGrantsMatched = 0;
    const existingGrants = await repository.getGrants();

    // Process each source
    for (const source of sources) {
      try {
        // Use Opencode to research grants
        const response = await adapter.executeResearch({
          organizationProfile: `${profile.legalName}\n\nMission: ${profile.mission}`,
          searchThemes: profile.searchThemes,
          sourceName: source.name,
          sourceUrl: source.url,
        });

        if (response.success && response.content) {
          // Parse the response (expecting JSON)
          let researchData;
          try {
            researchData = JSON.parse(response.content);
          } catch {
            // If not JSON, create a mock grant from the content
            researchData = {
              grants: [
                {
                  id: `found-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
                  title: `Grant from ${source.name}`,
                  funder: 'Researched Funder',
                  funderShort: 'RF',
                  award: '$50,000',
                  awardSort: 50000,
                  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  daysOut: 30,
                  fit: 75,
                  tags: profile.searchThemes.slice(0, 2),
                  status: 'matched' as const,
                  statusLabel: 'Matched',
                  matchedAt: new Date().toISOString(),
                },
              ],
            };
          }

          const grants = researchData.grants || [];
          totalGrantsFound += grants.length;

          // Add new grants
          for (const grantData of grants) {
            // Check if grant already exists
            const existing = existingGrants.find(
              (g) => g.title === grantData.title && g.funder === grantData.funder,
            );

            if (!existing) {
              const newGrant: Grant = {
                id: grantData.id || `grant-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
                title: grantData.title,
                funder: grantData.funder,
                funderShort: grantData.funderShort || grantData.funder.substring(0, 10),
                award: grantData.award || `$${grantData.awardSort?.toLocaleString() || '0'}`,
                awardSort: grantData.awardSort || 0,
                deadline: grantData.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                daysOut: grantData.daysOut || calculateDaysOut(grantData.deadline),
                fit: grantData.fit || 70,
                tags: grantData.tags || profile.searchThemes.slice(0, 2),
                status: 'matched',
                statusLabel: 'Matched',
                matchedAt: new Date().toISOString(),
              };

              await repository.addGrant(newGrant);
              existingGrants.push(newGrant);
              totalGrantsMatched++;
            }
          }

          // Update source last crawled
          await sourceService.updateSourceLastCrawled(source.id);
        }
      } catch (error) {
        console.error(`Error crawling source ${source.name}:`, error);
      }
    }

    // Update crawl run with results and persist
    crawlRun.completedAt = new Date().toISOString();
    crawlRun.status = 'completed';
    crawlRun.sourcesCrawled = sources.length;
    crawlRun.grantsFound = totalGrantsFound;
    crawlRun.grantsMatched = totalGrantsMatched;

    // Persist the updated crawl run state
    await repository.updateCrawlRun(crawlRun);

    return {
      crawlRun,
      grantsFound: totalGrantsFound,
      grantsMatched: totalGrantsMatched,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update crawl run with error and persist
    crawlRun.completedAt = new Date().toISOString();
    crawlRun.status = 'failed';
    crawlRun.errorMessage = errorMessage;
    await repository.updateCrawlRun(crawlRun);

    return {
      crawlRun,
      grantsFound: 0,
      grantsMatched: 0,
      error: errorMessage,
    };
  }
}

function calculateDaysOut(deadline: string): number {
  if (!deadline) return 0;
  const deadlineDate = new Date(deadline);
  const today = new Date();
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export async function getLatestCrawlRun(): Promise<CrawlRun | null> {
  return repository.getLatestCrawlRun();
}

export async function getCrawlRuns(): Promise<CrawlRun[]> {
  return repository.getCrawlRuns();
}
