// @vitest-environment node
import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as documentPOST } from '../../../documents/route';
import { createDependencies, resetDependencies, setDependencies } from '@/server/grant-ops/dependencies';
import * as repository from '../../../../../server/grant-ops/repository';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { Grant, OrganizationProfile, OpencodeSettings } from '../../../../../../../shared/types';
import { POST as draftPOST } from './route';

const fixturePath = path.join(
  process.cwd(),
  'tests/fixtures/documents/hacker-dojo-program-summary.pdf',
);

function buildMultipartRequest(fields: Record<string, string>, file: { name: string; type: string; bytes: Buffer }) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  formData.append('file', new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
  return { formData };
}

const profile: OrganizationProfile = {
  legalName: 'Hacker Dojo',
  ein: '12-3456789',
  samUEI: 'XyxabC123AB',
  nonprofitStatus: '501(c)(3)',
  yearFounded: 2009,contactInfo: {},
  geography: 'Regional',
  mission: 'Test mission',
  programAreas: ['STEM'],
  populationsServed: ['Youth'],
  fundingHistory: [],
  partnerships: [],
  complianceFacts: [],
  boardMembers: [],docTypes: ['PDF', 'DOCX'],
  searchThemes: ['EdTech'],
  agentBehavior: {
    autoDraftThreshold: 80,
    submissionPolicy: 'human-review-required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'professional',
  },
};

const settings: OpencodeSettings = {
  binaryPath: '/usr/local/bin/opencode',
  workingDirectory: '/tmp/hacker-dojo',
  timeoutMs: 60000,
  profile: 'default',
  isConfigured: true,
};

const fakeAdapter = {
  executeResearch: vi.fn(),
  generateDraft: vi.fn().mockImplementation(async (request) => ({
    success: true,
    content: `Grounding:\n${request.groundingDocuments?.join('\n') || ''}\nNotes:\n${request.revisionNotes || ''}`,
  })),
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

function createGrant(id: string): Grant {
  return {
    id,
    title: 'Test Grant for Draft Route',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$25,000',
    awardSort: 25000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 75,
    tags: ['Test'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-01',
  };
}

describe('/api/grants/[grantId]/draft route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let grant: Grant;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(createDependencies({ createOpencodeAdapter: () => fakeAdapter }));
    grant = createGrant(`draft-${Date.now()}`);
    await repository.addGrant(grant);
    await repository.updateOrgProfile(profile);
    await repository.updateOpencodeSettings(settings);
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('rejects missing grant ids with 404', async () => {
    const response = await draftPOST(
      new Request('http://localhost/api/grants/missing/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revisionNotes: 'Please revise' }),
      }) as never,
      { params: Promise.resolve({ grantId: 'missing' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Grant not found/i);
  });

  it('accepts empty draft requests and grounds draft generation from extracted PDF content only', async () => {
    const payload = await buildMultipartRequest(
      { name: 'Hacker Dojo Program Summary', type: 'PDF' },
      {
        name: 'hacker-dojo-program-summary.pdf',
        type: 'application/pdf',
        bytes: await fs.readFile(fixturePath),
      },
    );

    const documentResponse = await documentPOST({ formData: async () => payload.formData } as never);
    const documentData = await documentResponse.json();

    expect(documentResponse.status).toBe(201);
    expect(documentData.extractionStatus).toBe('extracted');
    expect(documentData.contentSnippet).toBe(
      'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
    );

    const response = await draftPOST(
      new Request(`http://localhost/api/grants/${grant.id}/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const queued = await response.json();

    expect(response.status).toBe(202);
    expect(queued.queued).toBe(true);
    await waitFor(async () => (await repository.getJobQueueItem(queued.job.id))?.status === 'completed');
    const job = await repository.getJobQueueItem(queued.job.id);
    expect(job?.resultSummary).toMatch(/Draft v1 generated/i);
    const drafts = await repository.getDraftArtifacts(grant.id);
    expect(drafts.at(-1)?.content).toContain(
      'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
    );
    expect(drafts.at(-1)?.content).not.toContain('stored_unparsed');
  });

  it('returns 400 when opencode settings are not configured', async () => {
    await repository.updateOpencodeSettings({ ...settings, isConfigured: false });

    const response = await draftPOST(
      new Request(`http://localhost/api/grants/${grant.id}/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revisionNotes: 'Please revise' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Opencode is not configured/i);
  });
});
