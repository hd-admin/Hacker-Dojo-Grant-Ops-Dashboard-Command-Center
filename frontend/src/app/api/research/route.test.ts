import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrawlRun, OrganizationProfile, OpencodeSettings } from '../../../../../shared/types';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import { createDependencies, resetDependencies, setDependencies } from '@/server/grant-ops/dependencies';
import * as repository from '@/server/grant-ops/repository';
import * as researchService from '@/server/grant-ops/research-service';
import { GET, POST } from './route';
import { POST as createSource } from '../sources/route';

const profile: OrganizationProfile = {
  legalName: 'Hacker Dojo',
  ein: '94-3359594',
  samUEI: 'ABC123DEF456',
  nonprofitStatus: '501(c)(3)',
  contactInfo: {},
  geography: 'Regional',
  mission: 'Community learning and technology access',
  programAreas: ['STEM'],
  populationsServed: ['Youth'],
  fundingHistory: [],
  partnerships: [],
  complianceFacts: [],
  docTypes: ['PDF'],
  searchThemes: ['EdTech'],
  agentBehavior: {
    autoDraftThreshold: 75,
    submissionPolicy: 'Human approval required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'Plain-spoken',
  },
};

const configuredSettings: OpencodeSettings = {
  binaryPath: '/usr/local/bin/opencode',
  workingDirectory: '/tmp/hacker-dojo',
  timeoutMs: 60000,
  profile: 'default',
  isConfigured: true,
};

const fakeAdapter = {
  executeResearch: vi.fn().mockResolvedValue({
    success: true,
    content: JSON.stringify({
      grants: [
        {
          id: 'grant-1',
          title: 'Community Innovation Grant',
          funder: 'Example Foundation',
          funderShort: 'EF',
          award: '$50,000',
          awardSort: 50000,
          deadline: '2026-06-30',
          daysOut: 30,
          fit: 90,
          tags: ['Community', 'EdTech'],
          status: 'matched',
          statusLabel: 'Matched',
          matchedAt: '2026-05-22T00:00:00.000Z',
        },
      ],
      evidence: [],
      rationale: 'fake',
    }),
  }),
  generateDraft: vi.fn().mockResolvedValue({
    success: true,
    content: JSON.stringify({ grants: [], evidence: [], rationale: 'auto-draft mock' }),
  }),
  isConfigured: () => true,
};

async function waitFor(predicate: () => Promise<boolean> | boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

describe('/api/research route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(
      createDependencies({
        createOpencodeAdapter: () => fakeAdapter,
      }),
    );
    await repository.updateOrgProfile(profile);
    await repository.updateOpencodeSettings(configuredSettings);
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('creates a source then persists crawl metadata including sourcesCrawled', async () => {
    const createResponse = await createSource(
      new Request('http://localhost/api/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Candid', url: 'https://www.candid.org', type: 'website' }),
      }) as never,
    );
    expect(createResponse.status).toBe(201);

    const response = await POST(new Request('http://localhost/api/research', { method: 'POST' }) as never);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.queued).toBe(true);
    expect(data.job.status).toBe('queued');

    await waitFor(async () => (await repository.getJobQueueItem(data.job.id))?.status === 'completed');
    const completedJob = await repository.getJobQueueItem(data.job.id);
    expect(completedJob?.resultSummary).toContain('Research completed');

    const getResponse = await GET(new Request('http://localhost/api/research') as never);
    const getData = await getResponse.json();
    expect(getData.latestRun?.sourcesCrawled).toBe(1);
    expect(getData.allRuns).toHaveLength(1);
  });

  it('rejects missing Opencode configuration', async () => {
    await repository.updateOpencodeSettings({ ...configuredSettings, isConfigured: false });

    const response = await POST(new Request('http://localhost/api/research', { method: 'POST' }) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('OPENCODE_NOT_CONFIGURED');
    expect(data.message).toMatch(/Opencode is not configured/i);
  });

  describe('null crawlRun guard', () => {
    it('returns 500 with persisted-crawlRun error when crawlRun is null', async () => {
      const spy = vi.spyOn(researchService, 'runResearch').mockResolvedValueOnce({
        crawlRun: null as unknown as CrawlRun,
        grantsFound: 0,
        grantsMatched: 0,
      });

      const response = await POST(new Request('http://localhost/api/research', { method: 'POST' }) as never);
      const data = await response.json();

      expect(response.status).toBe(202);
      expect(data.queued).toBe(true);

      await waitFor(async () => (await repository.getJobQueueItem(data.job.id))?.status === 'failed');
      const failedJob = await repository.getJobQueueItem(data.job.id);
      expect(failedJob?.errorMessage).toMatch(/crawlRun|persisted/i);

      spy.mockRestore();
    });
  });
});
