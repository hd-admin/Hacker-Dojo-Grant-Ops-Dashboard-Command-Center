import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { withTempDataDir, invalidateCache } from '../../../../../shared/grant-ops-persistence';
import { GET, PUT } from './route';

describe('GET /api/themes', () => {
  let tempDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    invalidateCache();
    await tempDir.cleanup();
  });

  it('returns default structure when no themes saved', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.keywordClusters)).toBe(true);
    expect(Array.isArray(data.themes)).toBe(true);
    expect(Array.isArray(data.regions)).toBe(true);
    expect(Array.isArray(data.populations)).toBe(true);
    expect(Array.isArray(data.strategicPriorities)).toBe(true);
  });
});

describe('PUT /api/themes', () => {
  let tempDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    invalidateCache();
    await tempDir.cleanup();
  });

  it('saves keyword clusters and returns updated data', async () => {
    const body = {
      keywordClusters: [{ id: 'kc-1', name: 'STEM', keywords: ['STEM'], weight: 80, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      themes: [],
      regions: [],
      populations: [],
      strategicPriorities: [],
    };
    const req = new Request('http://localhost/api/themes', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const response = await PUT(req as Parameters<typeof PUT>[0]);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.keywordClusters).toHaveLength(1);
    expect(data.keywordClusters[0].name).toBe('STEM');
  });

  it('rejects matchThreshold > 100', async () => {
    const invalidTheme = {
      id: 't1',
      name: 'T',
      keywordClusters: [],
      regions: [],
      populations: [],
      strategicPriorities: [],
      matchingPolicy: { matchThreshold: 150, autoDraftThreshold: 85, includeRules: [], excludeRules: [] },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const body = { keywordClusters: [], themes: [invalidTheme], regions: [], populations: [], strategicPriorities: [] };
    const req = new Request('http://localhost/api/themes', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    const response = await PUT(req as Parameters<typeof PUT>[0]);
    expect(response.status).toBe(400);
  });

  it('rejects invalid body', async () => {
    const req = new Request('http://localhost/api/themes', {
      method: 'PUT',
      body: 'not-json',
      headers: { 'content-type': 'application/json' },
    });
    const response = await PUT(req as Parameters<typeof PUT>[0]);
    expect(response.status).toBe(400);
  });
});
