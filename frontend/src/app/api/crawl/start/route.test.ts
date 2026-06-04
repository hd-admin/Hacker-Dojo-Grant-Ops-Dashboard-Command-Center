import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrganizationProfile, OpencodeSettings } from '../../../../../../shared/types';
import { invalidateCache, withTempDataDir } from '../../../../../../shared/grant-ops-persistence';
import {
  createDependencies,
  resetDependencies,
  setDependencies,
} from '@/server/grant-ops/dependencies';
import * as repository from '@/server/grant-ops/repository';
import * as _researchService from '@/server/grant-ops/research-service';
import { POST } from './route';

const profile: OrganizationProfile = {
  legalName: 'Hacker Dojo',
  ein: '94-3359594',
  samUEI: 'ABC123DEF456',
  nonprofitStatus: '501(c)(3)',
  yearFounded: 2009,
  contactInfo: {},
  geography: 'Regional',
  mission: 'Community learning and technology access',
  programAreas: ['STEM'],
  populationsServed: ['Youth'],
  fundingHistory: [],
  partnerships: [],
  complianceFacts: [],
  boardMembers: [],
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

describe('/api/crawl/start', () => {
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

  it('queues a crawl job and returns 202 with jobId', async () => {
    const request = new Request('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceId: 'source-test' }),
    });

    const response = await POST(request as unknown as import('next/server').NextRequest);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.queued).toBe(true);
    expect(body.job.id).toMatch(/^job-/);
  });

  it('accepts empty body and still returns 202', async () => {
    const request = new Request('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request as unknown as import('next/server').NextRequest);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.queued).toBe(true);
    expect(body.job.id).toMatch(/^job-/);
  });

  it('returns 202 for invalid request body by falling back to empty object', async () => {
    const request = new Request('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });

    const response = await POST(request as unknown as import('next/server').NextRequest);
    const body = await response.json();
    expect(response.status).toBe(202);
    expect(body.job.id).toMatch(/^job-/);
  });
});
