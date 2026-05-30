import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { Grant, SubmissionManifest } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { POST as approvalPOST } from '../approval/route';
import { GET, POST } from './route';

function createGrant(id: string): Grant {
  return {
    id,
    title: 'Test Grant for Submit',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$75,000',
    awardSort: 75000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 90,
    tags: ['Test'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-01',
    draftContent: 'Test draft content',
  };
}

function createManifest(grantId: string): SubmissionManifest {
  return {
    id: `manifest-${grantId}`,
    grantId,
    version: 1,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    materialRefs: [],
  };
}

describe('/api/grants/[grantId]/submit route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let grant: Grant;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    grant = createGrant(`submit-${Date.now()}`);
    await repository.addGrant(grant);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns 404 when grant is missing', async () => {
    const response = await POST(
      new Request('http://localhost/api/grants/missing/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: { type: 'portal', submittedBy: 'human' } }),
      }) as never,
      { params: Promise.resolve({ grantId: 'missing' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Grant not found/i);
  });

  it('returns 400 for invalid body shapes', async () => {
    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: { type: 123 } }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Submission method is required/i);
  });

  it('returns 400 until the grant has been approved', async () => {
    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: { type: 'portal', submittedBy: 'human' } }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Grant must be approved before submission/i);
  });

  it('returns 201 when approval auto-creates manifest allowing immediate submission', async () => {
    await approvalPOST(
      new Request(`http://localhost/api/grants/${grant.id}/approval`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'human' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: { type: 'portal', submittedBy: 'human' } }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.submissionRecord.grantId).toBe(grant.id);
  });

  it('returns submissionRecord and followUps after approval', async () => {
    const approvalResponse = await approvalPOST(
      new Request(`http://localhost/api/grants/${grant.id}/approval`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'human' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    expect(approvalResponse.status).toBe(201);
    await repository.addSubmissionManifest(createManifest(grant.id));

    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          method: { type: 'portal', portalUrl: 'https://example.com/submit', submittedBy: 'human' },
          notes: 'Submitted via portal',
        }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.submissionRecord.grantId).toBe(grant.id);
    expect(Array.isArray(data.followUps)).toBe(true);
    expect((await repository.getGrant(grant.id))?.status).toBe('submitted');
  });

  it('GET returns the current submission record after submit', async () => {
    await approvalPOST(
      new Request(`http://localhost/api/grants/${grant.id}/approval`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'human' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    await repository.addSubmissionManifest(createManifest(grant.id));
    await POST(
      new Request(`http://localhost/api/grants/${grant.id}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: { type: 'portal', submittedBy: 'human' } }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );

    const getResponse = await GET(new Request(`http://localhost/api/grants/${grant.id}/submit`) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });
    const getData = await getResponse.json();
    expect(getData?.grantId).toBe(grant.id);
  });
});
