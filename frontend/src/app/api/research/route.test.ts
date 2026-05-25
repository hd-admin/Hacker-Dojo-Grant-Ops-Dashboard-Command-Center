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
  mission: 'Community learning and technology access',
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
  generateDraft: vi.fn(),
  isConfigured: () => true,
};

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

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.sourcesCrawled).toBe(1);
    expect(data.grantsFound).toBe(1);
    expect(data.grantsMatched).toBe(1);
    expect(data.crawlRun.status).toBe('completed');

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
    expect(data.error).toMatch(/Opencode is not configured/i);
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

      expect(response.status).toBe(500);
      expect(data.error).toMatch(/crawlRun|persisted/i);

      spy.mockRestore();
    });
  });
});
