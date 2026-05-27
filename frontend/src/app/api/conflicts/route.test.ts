import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import type { ConflictRecord } from '../../../../../shared/types';
import * as repository from '../../../server/grant-ops/repository';
import { GET } from './route';

function createConflict(id: string, grantId: string): ConflictRecord {
  return {
    id,
    grantId,
    fieldName: 'deadline',
    values: [
      { value: '2026-10-01', sourceId: 'source-a', crawledAt: '2026-05-27T00:00:00.000Z' },
      { value: '2026-10-15', sourceId: 'source-b', crawledAt: '2026-05-27T01:00:00.000Z' },
    ],
  };
}

describe('/api/conflicts route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    await repository.addConflictRecord(createConflict('conflict-a', 'grant-a'));
    await repository.addConflictRecord(createConflict('conflict-b', 'grant-b'));
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('lists conflict records and respects the grantId filter', async () => {
    const allResponse = await GET(new Request('http://localhost/api/conflicts') as never);
    const allData = await allResponse.json();
    expect(allResponse.status).toBe(200);
    expect(allData).toHaveLength(2);

    const filteredResponse = await GET(new Request('http://localhost/api/conflicts?grantId=grant-a') as never);
    const filteredData = await filteredResponse.json();
    expect(filteredResponse.status).toBe(200);
    expect(filteredData).toHaveLength(1);
    expect(filteredData[0]?.id).toBe('conflict-a');
  });
});
