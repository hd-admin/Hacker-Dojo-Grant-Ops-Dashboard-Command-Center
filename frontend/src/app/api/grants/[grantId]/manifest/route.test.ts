import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { Grant } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { GET, POST } from './route';

function createGrant(id: string): Grant {
  return {
    id,
    title: 'Manifest Grant',
    funder: 'Manifest Foundation',
    funderShort: 'MF',
    award: '$20,000',
    awardSort: 20000,
    deadline: '2026-11-30',
    daysOut: 150,
    fit: 67,
    tags: ['STEM'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-27',
  };
}

describe('/api/grants/[grantId]/manifest route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let grant: Grant;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    grant = createGrant(`grant-${Date.now()}`);
    await repository.addGrant(grant);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns 404 when creating a manifest for a missing grant', async () => {
    const response = await POST(new Request('http://localhost/api/grants/missing/manifest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ materialRefs: [] }),
    }) as never, {
      params: Promise.resolve({ grantId: 'missing' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Grant not found/i);
  });

  it('creates and returns a submission manifest for an existing grant', async () => {
    const createResponse = await POST(new Request(`http://localhost/api/grants/${grant.id}/manifest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instructions: 'Upload all PDF materials in the portal',
        portalUrl: 'https://example.org/submit',
        materialRefs: [{ documentId: 'doc-1', documentName: 'Narrative.pdf', role: 'narrative' }],
        notes: 'Remember to attach the budget workbook',
      }),
    }) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });
    const created = await createResponse.json();

    expect(createResponse.status).toBe(200);
    expect(created.grantId).toBe(grant.id);
    expect(created.version).toBe(1);
    expect(created.materialRefs).toHaveLength(1);

    const getResponse = await GET(new Request(`http://localhost/api/grants/${grant.id}/manifest`) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });
    const fetched = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(fetched.id).toBe(created.id);
    expect(fetched.instructions).toBe('Upload all PDF materials in the portal');
  });
});
