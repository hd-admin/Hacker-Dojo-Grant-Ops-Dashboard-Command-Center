/**
 * Funder Insights API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OrganizationProfile, OpencodeSettings } from '../../../../../shared/types';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import {
  createDependencies,
  resetDependencies,
  setDependencies,
} from '@/server/grant-ops/dependencies';
import { createOpencodeAdapter } from '@/server/grant-ops/opencode-client';
import * as repository from '@/server/grant-ops/repository';
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

async function waitFor(
  predicate: () => Promise<boolean> | boolean,
  timeoutMs = 5000,
): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

describe('/api/funder-insights route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(
      createDependencies({
        createOpencodeAdapter: (settings, _providerType) =>
          createOpencodeAdapter(settings, 'fake'),
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

  it('queues a funder insights job and returns 202 with job', async () => {
    const req = new Request('http://localhost/api/funder-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await POST(req as unknown as import('next/server').NextRequest);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.queued).toBe(true);
    expect(data.job.status).toBe('queued');

    await waitFor(
      async () => (await repository.getJobQueueItem(data.job.id))?.status === 'completed',
    );
    const completedJob = await repository.getJobQueueItem(data.job.id);
    expect(completedJob?.status).toBe('completed');
    expect(completedJob?.resultSummary).toMatch(/Funder insights completed/i);
  });

  it('queues with funderId', async () => {
    const req = new Request('http://localhost/api/funder-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funderId: 'f1' }),
    });
    const response = await POST(req as unknown as import('next/server').NextRequest);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.queued).toBe(true);
    expect(data.job.id).toBeDefined();
  });

  it('returns 202 for invalid request body by falling back to empty object', async () => {
    const req = new Request('http://localhost/api/funder-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const response = await POST(req as unknown as import('next/server').NextRequest);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.queued).toBe(true);
  });

  it('rejects missing Opencode configuration', async () => {
    await repository.updateOpencodeSettings({ ...configuredSettings, isConfigured: false });

    const req = new Request('http://localhost/api/funder-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await POST(req as unknown as import('next/server').NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('OPENCODE_NOT_CONFIGURED');
  });
});
