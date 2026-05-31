import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { Grant } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { GET, POST } from './route';

function createGrant(id: string): Grant {
  return {
    id,
    title: 'Test Grant for Approval',
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 85,
    tags: ['Test'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-01',
  };
}

describe('/api/grants/[grantId]/approval route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let grant: Grant;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    grant = createGrant(`approval-${Date.now()}`);
    await repository.addGrant(grant);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns 404 when grant is missing', async () => {
    const response = await POST(
      new Request('http://localhost/api/grants/missing/approval', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'human' }),
      }) as never,
      { params: Promise.resolve({ grantId: 'missing' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Grant not found/i);
  });

  it('returns 400 for invalid body shapes', async () => {
    const response = await POST(
      new Request('http://localhost/api/grants/test/approval', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedBy: 123 }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid request body/i);
  });

  it('returns approvalRecord on success and GET reads it back', async () => {
    const response = await POST(
      new Request(`http://localhost/api/grants/${grant.id}/approval`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'human' }),
      }) as never,
      { params: Promise.resolve({ grantId: grant.id }) },
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.approvalRecord.grantId).toBe(grant.id);
    expect(data.approvalRecord.approvedBy).toBe('human');

    const getResponse = await GET(new Request(`http://localhost/api/grants/${grant.id}/approval`) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });
    const getData = await getResponse.json();
    expect(getData?.grantId).toBe(grant.id);
  });
});
