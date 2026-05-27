import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import type { DuplicateCandidate } from '../../../../../shared/types';
import * as repository from '../../../server/grant-ops/repository';
import { GET } from './route';

function createCandidate(id: string, status: DuplicateCandidate['status']): DuplicateCandidate {
  return {
    id,
    grantId1: `${id}-a`,
    grantId2: `${id}-b`,
    confidenceScore: 0.91,
    status,
    detectedAt: '2026-05-27T00:00:00.000Z',
    conflictingFields: ['title', 'deadline'],
  };
}

describe('/api/duplicates route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    await repository.addDuplicateCandidate(createCandidate('dup-pending', 'pending'));
    await repository.addDuplicateCandidate(createCandidate('dup-merged', 'merged'));
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('lists duplicate candidates and respects the status filter', async () => {
    const allResponse = await GET(new Request('http://localhost/api/duplicates') as never);
    const allData = await allResponse.json();
    expect(allResponse.status).toBe(200);
    expect(allData).toHaveLength(2);

    const filteredResponse = await GET(new Request('http://localhost/api/duplicates?status=pending') as never);
    const filteredData = await filteredResponse.json();
    expect(filteredResponse.status).toBe(200);
    expect(filteredData).toHaveLength(1);
    expect(filteredData[0]?.id).toBe('dup-pending');
  });
});
