import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../shared/grant-ops-persistence';
import { defaultOpencodeSettings } from '../../../../../../shared/seed-data';
import * as repository from '../../../../server/grant-ops/repository';
import { POST } from './route';

const execFileSyncMock = vi.hoisted(() => vi.fn());
const accessMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
  spawn: vi.fn(),
  default: { execFileSync: execFileSyncMock, spawn: vi.fn() },
}));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    default: actual,
    access: accessMock,
  };
});

describe('/api/sources/discover route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    execFileSyncMock.mockReset();
    accessMock.mockReset();
    accessMock.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('rejects invalid discovery prompts', async () => {
    const response = await POST(new Request('http://localhost/api/sources/discover', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    }) as never);

    expect(response.status).toBe(400);
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
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('returns source suggestions when opencode is configured', async () => {
    await repository.updateOpencodeSettings({
      ...defaultOpencodeSettings,
      binaryPath: '/usr/local/bin/opencode',
      workingDirectory: tempDataDir.dataDir,
      isConfigured: true,
    });

    execFileSyncMock.mockReturnValueOnce(JSON.stringify([
      {
        name: 'Community Grants Tracker',
        url: 'https://www.communitygrants.org/active-grants',
        type: 'website',
        rationale: 'Tracks active grant opportunities for nonprofits.',
        confidence: 0.95,
      },
    ]));

    const response = await POST(new Request('http://localhost/api/sources/discover', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'Find education community innovation grants' }),
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.suggestions)).toBe(true);
    expect(data.suggestions).toHaveLength(1);
    expect(data.suggestions[0]?.suggestedBy).toBe('ai');
    expect(data.suggestions[0]?.rationale).toMatch(/tracks active grant opportunities/i);
    expect(data.unavailable).toBeUndefined();
  });
});
