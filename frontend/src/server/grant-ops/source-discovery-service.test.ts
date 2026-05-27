import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../shared/grant-ops-persistence';
import { defaultOpencodeSettings } from '../../../../shared/seed-data';
import * as repository from './repository';
import { discoverSourcesFromPrompt } from './source-discovery-service';

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

describe('source-discovery-service', () => {
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

  it('returns unavailable when opencode is not configured', async () => {
    const result = await discoverSourcesFromPrompt('Find education grants');

    expect(result).toEqual({ suggestions: [], unavailable: true });
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('returns parsed source suggestions from opencode output', async () => {
    await repository.updateOpencodeSettings({
      ...defaultOpencodeSettings,
      binaryPath: '/usr/local/bin/opencode',
      workingDirectory: tempDataDir.dataDir,
      isConfigured: true,
    });

    execFileSyncMock.mockReturnValueOnce(JSON.stringify([
      {
        name: 'State Arts Grants Database',
        url: 'https://www.arts.gov/grants',
        type: 'database',
        rationale: 'Contains active arts and culture funding opportunities.',
        confidence: 0.91,
      },
      {
        name: 'Community Foundation Grants',
        url: 'https://www.candid.org/community-foundation-grants',
        type: 'website',
        rationale: 'Tracks locally relevant grant programs for nonprofits.',
        confidence: 0.83,
      },
    ]));

    const result = await discoverSourcesFromPrompt('Find arts and community grants');

    expect(result.unavailable).toBeUndefined();
    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0]?.suggestedBy).toBe('ai');
    expect(result.suggestions[0]?.url).toBe('https://www.arts.gov/grants');
    expect(result.suggestions[0]?.rationale).toMatch(/arts and culture/i);
    expect(result.suggestions[0]?.id).toMatch(/^suggestion-/);
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list when opencode output is malformed', async () => {
    await repository.updateOpencodeSettings({
      ...defaultOpencodeSettings,
      binaryPath: '/usr/local/bin/opencode',
      workingDirectory: tempDataDir.dataDir,
      isConfigured: true,
    });

    execFileSyncMock.mockReturnValueOnce('not-json');

    const result = await discoverSourcesFromPrompt('Find grant sources');

    expect(result).toEqual({ suggestions: [] });
  });

  it('returns an empty list when opencode throws', async () => {
    await repository.updateOpencodeSettings({
      ...defaultOpencodeSettings,
      binaryPath: '/usr/local/bin/opencode',
      workingDirectory: tempDataDir.dataDir,
      isConfigured: true,
    });

    execFileSyncMock.mockImplementationOnce(() => {
      throw new Error('Opencode timed out after 3000ms');
    });

    const result = await discoverSourcesFromPrompt('Find grant sources');

    expect(result).toEqual({ suggestions: [] });
  });
});
