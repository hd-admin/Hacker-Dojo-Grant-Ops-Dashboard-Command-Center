import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationProfile, OpencodeSettings } from '../../../../../shared/types';

vi.mock('@/server/grant-ops/dependencies', () => ({
  getDependencies: vi.fn(),
  setDependencies: vi.fn(),
  resetDependencies: vi.fn(),
  createDependencies: vi.fn(),
  systemClock: { now: () => new Date('2026-05-22T00:00:00.000Z') },
  cryptoIdGenerator: { generateId: (prefix: string) => `${prefix}-test-id` },
  cwdPersistenceRoot: { getBaseDir: () => '/tmp/test' },
}));

vi.mock('@/server/grant-ops/research-service', () => ({
  runResearch: vi.fn(),
  getLatestCrawlRun: vi.fn(),
  getCrawlRuns: vi.fn(),
}));

import { getDependencies } from '@/server/grant-ops/dependencies';
import * as researchService from '@/server/grant-ops/research-service';
import { GET, POST } from './route';

const mockedGetDependencies = vi.mocked(getDependencies);

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

const getOrgProfileMock = vi.fn();
const getOpencodeSettingsMock = vi.fn();

const mockDeps = {
  repository: {
    getOrgProfile: getOrgProfileMock,
    getOpencodeSettings: getOpencodeSettingsMock,
  },
  sourceService: {
    getActiveSources: vi.fn(),
    addSource: vi.fn(),
    updateSourceLastCrawled: vi.fn(),
  },
  createOpencodeAdapter: vi.fn(),
  clock: { now: () => new Date('2026-05-22T00:00:00.000Z') },
  idGenerator: { generateId: (prefix: string) => `${prefix}-test-id` },
  persistenceRoot: { getBaseDir: () => '/tmp/test' },
} as unknown as ReturnType<typeof getDependencies>;

describe('/api/research route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDependencies.mockReturnValue(mockDeps);
    getOrgProfileMock.mockResolvedValue(profile);
    getOpencodeSettingsMock.mockResolvedValue(configuredSettings);
    vi.mocked(researchService.runResearch).mockResolvedValue({
      crawlRun: {
        id: 'crawl-test-id',
        startedAt: '2026-05-22T00:00:00.000Z',
        completedAt: '2026-05-22T00:01:00.000Z',
        status: 'completed',
        sourcesCrawled: 1,
        grantsFound: 2,
        grantsMatched: 1,
      },
      grantsFound: 2,
      grantsMatched: 1,
    });
    vi.mocked(researchService.getLatestCrawlRun).mockResolvedValue(null);
    vi.mocked(researchService.getCrawlRuns).mockResolvedValue([]);
  });

  it('POST returns research results when profile and Opencode are configured', async () => {
    const response = await POST(new Request('http://localhost/api/research', { method: 'POST' }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.grantsFound).toBe(2);
    expect(data.grantsMatched).toBe(1);
    expect(researchService.runResearch).toHaveBeenCalledWith(profile);
  });

  it('POST fails with 400 when Opencode settings are not configured', async () => {
    getOpencodeSettingsMock.mockResolvedValue({ ...configuredSettings, isConfigured: false });

    const response = await POST(new Request('http://localhost/api/research', { method: 'POST' }) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Opencode is not configured/i);
    expect(researchService.runResearch).not.toHaveBeenCalled();
  });

  it('GET returns the latest crawl run and all runs', async () => {
    vi.mocked(researchService.getLatestCrawlRun).mockResolvedValue({
      id: 'crawl-test-id',
      startedAt: '2026-05-22T00:00:00.000Z',
      completedAt: '2026-05-22T00:01:00.000Z',
      status: 'completed',
      sourcesCrawled: 1,
      grantsFound: 2,
      grantsMatched: 1,
    });
    vi.mocked(researchService.getCrawlRuns).mockResolvedValue([
      {
        id: 'crawl-test-id',
        startedAt: '2026-05-22T00:00:00.000Z',
        completedAt: '2026-05-22T00:01:00.000Z',
        status: 'completed',
        sourcesCrawled: 1,
        grantsFound: 2,
        grantsMatched: 1,
      },
    ]);

    const response = await GET(new Request('http://localhost/api/research') as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.latestRun?.id).toBe('crawl-test-id');
    expect(data.allRuns).toHaveLength(1);
  });
});
