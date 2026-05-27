import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../shared/grant-ops-persistence';
import type { DuplicateCandidate } from '../../../../../../shared/types';
import * as repository from '../../../../server/grant-ops/repository';
import { PATCH } from './route';

function createCandidate(id: string): DuplicateCandidate {
  return {
    id,
    grantId1: `${id}-a`,
    grantId2: `${id}-b`,
    confidenceScore: 0.97,
    status: 'pending',
    detectedAt: '2026-05-27T00:00:00.000Z',
    conflictingFields: ['title'],
  };
}

describe('/api/duplicates/[candidateId] route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let candidate: DuplicateCandidate;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    candidate = createCandidate('dup-route-test');
    await repository.addDuplicateCandidate(candidate);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('updates duplicate resolution state and records an audit trail entry', async () => {
    const response = await PATCH(new Request(`http://localhost/api/duplicates/${candidate.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'merge' }),
    }) as never, {
      params: Promise.resolve({ candidateId: candidate.id }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('merged');
    expect(data.resolvedBy).toBe('operator');
    expect(data.resolvedAt).toBeTruthy();

    const events = await repository.getAuditEvents();
    expect(events[0]?.eventType).toBe('duplicate_candidate_resolved');
    expect(events[0]?.entityId).toBe(candidate.id);
    expect(events[0]?.metadata).toMatchObject({ action: 'merge', status: 'merged' });
  });
});
