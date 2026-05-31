import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { Grant, OrganizationProfile, OpencodeSettings } from '../../../../../../../shared/types';
import { createDependencies, resetDependencies, setDependencies } from '@/server/grant-ops/dependencies';
import * as repository from '../../../../../server/grant-ops/repository';
import { POST } from './route';

const profile: OrganizationProfile = {
  legalName: 'Hacker Dojo',
  ein: '12-3456789',
  samUEI: 'XyxabC123AB',
  nonprofitStatus: '501(c)(3)',
  yearFounded: 2009,contactInfo: {},
  geography: 'Regional',
  mission: 'To support tech education',
  programAreas: ['STEM'],
  populationsServed: ['Youth'],
  fundingHistory: [],
  partnerships: [],
  complianceFacts: [],
  boardMembers: [],docTypes: ['PDF'],
  searchThemes: ['EdTech'],
  agentBehavior: {
    autoDraftThreshold: 80,
    submissionPolicy: 'Human approval required',
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
    content: `Draft grounded by: ${request.groundingDocuments?.[0] || 'none'}\n${request.revisionNotes || ''}`,
  })),
  isConfigured: () => true,
};

function createGrant(id: string): Grant {
  return {
    id,
    title: 'Test Grant for Revisions',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$25,000',
    awardSort: 25000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 75,
    tags: ['Test'],
    status: 'draft',
    statusLabel: 'Drafting',
    matchedAt: '2026-05-01',
    draftContent: 'Existing draft content',
  };
}

describe('/api/grants/[grantId]/revisions route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let grant: Grant;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(createDependencies({ createOpencodeAdapter: () => fakeAdapter }));
    grant = createGrant(`revision-${Date.now()}`);
    await repository.addGrant(grant);
    await repository.updateOrgProfile(profile);
    await repository.updateOpencodeSettings(settings);
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns 404 when grant is missing', async () => {
    const response = await POST(
      new Request('http://localhost/api/grants/missing/revisions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'Please revise' }),
      }) as never,
      { params: Promise.resolve({ grantId: 'missing' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Grant not found/i);
  });

  it('returns 400 for invalid body shapes', async () => {
    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 42 }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Revision notes are required/i);
  });

  it('returns 400 when profile or opencode settings are missing', async () => {
    await repository.updateOrgProfile(profile);
    await repository.updateOpencodeSettings({ ...settings, isConfigured: false });

    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'Please revise' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Opencode is not configured/i);
  });

  it('returns revision and draft payloads after validation passes', async () => {
    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: 'Please improve the budget section', requestedBy: 'human' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.revision.grantId).toBe(grant.id);
    expect(data.revision.notes).toContain('budget section');
    expect(data.draft.content).toContain('Please improve the budget section');
  });
});
