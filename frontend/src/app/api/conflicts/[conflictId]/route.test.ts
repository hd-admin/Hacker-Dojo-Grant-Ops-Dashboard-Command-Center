import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../shared/grant-ops-persistence';
import type { ConflictRecord } from '../../../../../../shared/types';
import * as repository from '../../../../server/grant-ops/repository';
import { PATCH } from './route';

function createConflict(id: string): ConflictRecord {
  return {
    id,
    grantId: 'grant-conflict',
    fieldName: 'portalUrl',
    values: [
      { value: 'https://one.example', sourceId: 'source-a', crawledAt: '2026-05-27T00:00:00.000Z' },
      { value: 'https://two.example', sourceId: 'source-b', crawledAt: '2026-05-27T01:00:00.000Z' },
    ],
  };
}

describe('/api/conflicts/[conflictId] route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let conflict: ConflictRecord;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    conflict = createConflict('conflict-route-test');
    await repository.addConflictRecord(conflict);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('resolves a conflict and records an audit trail entry', async () => {
    const response = await PATCH(new Request(`http://localhost/api/conflicts/${conflict.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ canonicalValue: 'https://canonical.example' }),
    }) as never, {
      params: Promise.resolve({ conflictId: conflict.id }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canonicalValue).toBe('https://canonical.example');
    expect(data.resolvedBy).toBe('operator');
    expect(data.resolvedAt).toBeTruthy();

    const events = await repository.getAuditEvents();
    expect(events[0]?.eventType).toBe('conflict_record_resolved');
    expect(events[0]?.entityId).toBe(conflict.id);
    expect(events[0]?.metadata).toMatchObject({ canonicalValue: 'https://canonical.example' });
  });
});
