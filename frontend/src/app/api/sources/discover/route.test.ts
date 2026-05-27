import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultOpencodeSettings } from '../../../../../../shared/seed-data';
import { invalidateCache, withTempDataDir } from '../../../../../../shared/grant-ops-persistence';
import * as repository from '../../../../server/grant-ops/repository';
import { POST } from './route';

describe('/api/sources/discover route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns unavailable when opencode is not configured', async () => {
    const response = await POST(new Request('http://localhost/api/sources/discover', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Find education grant sources' }),
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ suggestions: [], unavailable: true });
  });

  it('returns source suggestions when opencode is configured', async () => {
    await repository.updateOpencodeSettings({
      ...defaultOpencodeSettings,
      binaryPath: '/bin/opencode',
      isConfigured: true,
    });

    const response = await POST(new Request('http://localhost/api/sources/discover', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Find education community innovation grants' }),
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.suggestions)).toBe(true);
    expect(data.suggestions).toHaveLength(3);
    expect(data.suggestions[0]?.suggestedBy).toBe('ai');
    expect(data.suggestions[0]?.rationale).toMatch(/education|community/i);
    expect(data.unavailable).toBeUndefined();
  });
});
