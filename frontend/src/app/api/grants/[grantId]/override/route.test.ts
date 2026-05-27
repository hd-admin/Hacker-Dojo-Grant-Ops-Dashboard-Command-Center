import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { Grant } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { POST } from './route';

function createGrant(id: string): Grant {
  return {
    id,
    title: 'Override Me',
    funder: 'Example Foundation',
    funderShort: 'EF',
    award: '$75,000',
    awardSort: 75000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 72,
    tags: ['Education'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-27',
  };
}

describe('/api/grants/[grantId]/override route', () => {
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

  it('returns 404 for missing grants', async () => {
    const response = await POST(new Request('http://localhost/api/grants/missing/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field: 'fit', newValue: 85, rationale: 'Manual review', overrideType: 'score' }),
    }) as never, {
      params: Promise.resolve({ grantId: 'missing' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Grant not found/i);
  });

  it('persists human overrides and records an audit event', async () => {
    const response = await POST(new Request(`http://localhost/api/grants/${grant.id}/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field: 'fit', newValue: 88, rationale: 'Board approved manual adjustment', overrideType: 'score' }),
    }) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fit).toBe(88);
    expect(data.humanOverrides).toHaveLength(1);
    expect(data.humanOverrides[0]).toMatchObject({
      field: 'fit',
      previousValue: 72,
      newValue: 88,
      rationale: 'Board approved manual adjustment',
      overrideType: 'score',
    });

    const events = await repository.getAuditEvents();
    expect(events[0]?.eventType).toBe('human_override');
    expect(events[0]?.entityId).toBe(grant.id);
  });
});
