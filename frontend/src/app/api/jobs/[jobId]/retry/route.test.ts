import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { JobQueueItem, OrganizationProfile, OpencodeSettings } from '../../../../../../../shared/types';
import { createDependencies, resetDependencies, setDependencies } from '@/server/grant-ops/dependencies';
import * as repository from '../../../../../server/grant-ops/repository';
import { POST } from './route';

function createJob(id: string, status: JobQueueItem['status']): JobQueueItem {
  return {
    id,
    jobType: 'research',
    status,
    stage: status === 'failed' ? 'failed-fetch' : 'running-fetch',
    lastUpdate: '2026-05-27T00:00:00.000Z',
    createdAt: '2026-05-27T00:00:00.000Z',
    entityId: 'grant-123',
    retryCount: 1,
    errorMessage: status === 'failed' ? 'Timed out contacting provider' : undefined,
    failureCategory: status === 'failed' ? 'timeout' : undefined,
  };
}

async function waitFor(predicate: () => Promise<boolean> | boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

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

const opencodeSettings: OpencodeSettings = {
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
      grants: [],
      evidence: [],
      rationale: 'retry-test',
    }),
  }),
  generateDraft: vi.fn(),
  isConfigured: () => true,
};

describe('/api/jobs/[jobId]/retry route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(createDependencies({ createOpencodeAdapter: () => fakeAdapter }));
    await repository.updateOrgProfile(profile);
    await repository.updateOpencodeSettings(opencodeSettings);
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('creates a queued retry job for a failed job', async () => {
    // Add an approved source so the research job can run
    await repository.addSource({
      id: 'source-retry-test',
      name: 'Test Source',
      url: 'https://example.com',
      type: 'website',
      createdAt: new Date().toISOString(),
      isActive: true,
      reviewStatus: 'approved',
      sourceCrawlState: 'never-crawled',
      crawlAccessCategory: 'crawlable',
    });
    await repository.addJobQueueItem(createJob('job-failed', 'failed'));

    const response = await POST(new Request('http://localhost/api/jobs/job-failed/retry', {
      method: 'POST',
    }) as never, {
      params: Promise.resolve({ jobId: 'job-failed' }),
    });
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.success).toBe(true);
    expect(data.newJobId).toMatch(/^job-/);

    await waitFor(async () => (await repository.getJobQueueItem(data.newJobId))?.status === 'completed');
    const jobs = await repository.getJobQueue();
    expect(jobs).toHaveLength(2);
    const retried = jobs.find((job) => job.id === data.newJobId);
    expect(retried?.status).toBe('completed');
    expect(retried?.stage).toBe('completed');
    expect(retried?.entityId).toBe('grant-123');
    expect(retried?.retryCount).toBe(2);
    expect(retried?.resultSummary).toMatch(/Research completed/i);
    expect(fakeAdapter.executeResearch).toHaveBeenCalled();
  });

  it('rejects retry attempts for jobs that are not failed', async () => {
    await repository.addJobQueueItem(createJob('job-running', 'running'));

    const response = await POST(new Request('http://localhost/api/jobs/job-running/retry', {
      method: 'POST',
    }) as never, {
      params: Promise.resolve({ jobId: 'job-running' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Only failed jobs can be retried/i);
  });
});
