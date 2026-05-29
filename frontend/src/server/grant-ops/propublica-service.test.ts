import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTempDataDir } from '../../../../shared/grant-ops-persistence';
import type { OpencodeSettings } from '../../../../shared/types';
import { createDependencies, resetDependencies, type Dependencies } from './dependencies';
import * as repository from './repository';
import { ensureProPublicaSourceRegistered, fetchProPublicaGrants } from './propublica-service';

const execFileSyncMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
  spawn: vi.fn(),
  default: { execFileSync: execFileSyncMock, spawn: vi.fn() },
}));

describe('ensureProPublicaSourceRegistered', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    resetDependencies();
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
  });

  it('creates ProPublica source when none exists', async () => {
    await ensureProPublicaSourceRegistered();
    const sources = await repository.getSources();
    const pp = sources.find((s) => s.name === 'ProPublica Nonprofit Explorer');
    expect(pp).toBeDefined();
    expect(pp?.url).toBe('https://projects.propublica.org/nonprofits/');
    expect(pp?.isActive).toBe(true);
    expect(pp?.reviewStatus).toBe('approved');
    expect(pp?.type).toBe('api');
  });

  it('is idempotent when ProPublica already registered', async () => {
    await ensureProPublicaSourceRegistered();
    await ensureProPublicaSourceRegistered();
    const sources = await repository.getSources();
    const ppSources = sources.filter((s) => s.name === 'ProPublica Nonprofit Explorer');
    expect(ppSources).toHaveLength(1);
  });
});

describe('fetchProPublicaGrants', () => {
  let mockGetOpencodeSettings: ReturnType<typeof vi.fn>;
  let testDeps: Dependencies;
  let mockExecFileSync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExecFileSync = execFileSyncMock;
    execFileSyncMock.mockReset();
    mockGetOpencodeSettings = vi.fn<() => Promise<OpencodeSettings | null>>();
    const baseDeps = createDependencies();
    testDeps = { ...baseDeps, repository: { ...baseDeps.repository, getOpencodeSettings: mockGetOpencodeSettings } };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns unavailable=true when settings not configured and opencode not on PATH', async () => {
    mockGetOpencodeSettings.mockResolvedValue(null);
    mockExecFileSync.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT: which not found'), { code: 'ENOENT' });
    });
    const result = await fetchProPublicaGrants('STEM education', testDeps);
    expect(result).toEqual({ grants: [], unavailable: true });
  });

  it('returns grants from valid JSON array when settings are configured', async () => {
    mockGetOpencodeSettings.mockResolvedValue({
      isConfigured: true,
      binaryPath: '/fake/opencode',
      timeoutMs: 60000,
      workingDirectory: '/tmp',
    } as OpencodeSettings);
    const mockGrant = {
      id: 'pp-1',
      title: 'Test Grant',
      funder: 'Test Funder',
      funderShort: 'TF',
      award: '$50,000',
      awardSort: 50000,
      deadline: 'Rolling',
      daysOut: 365,
      fit: 85,
      tags: [],
      status: 'matched',
      statusLabel: 'Matched',
    };
    mockExecFileSync.mockReturnValue(JSON.stringify([mockGrant]));
    const result = await fetchProPublicaGrants('STEM', testDeps);
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0]!.title).toBe('Test Grant');
    expect(result.unavailable).toBeUndefined();
  });

  it('handles JSON wrapped in object with grants key', async () => {
    mockGetOpencodeSettings.mockResolvedValue({
      isConfigured: true,
      binaryPath: '/fake/opencode',
      timeoutMs: 60000,
      workingDirectory: '/tmp',
    } as OpencodeSettings);
    mockExecFileSync.mockReturnValue(JSON.stringify({ grants: [{ id: 'pp-1', title: 'T', funder: 'F' }] }));
    const result = await fetchProPublicaGrants('test', testDeps);
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0]!.title).toBe('T');
  });

  it('returns error string when execFileSync throws non-ENOENT error', async () => {
    mockGetOpencodeSettings.mockResolvedValue({
      isConfigured: true,
      binaryPath: '/fake/opencode',
      timeoutMs: 60000,
      workingDirectory: '/tmp',
    } as OpencodeSettings);
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ETIMEDOUT');
    });
    const result = await fetchProPublicaGrants('test', testDeps);
    expect(result.error).toBeDefined();
    expect(result.grants).toEqual([]);
    expect(result.unavailable).toBeUndefined();
  });

  it('returns unavailable when execFileSync throws ENOENT on configured path', async () => {
    mockGetOpencodeSettings.mockResolvedValue({
      isConfigured: true,
      binaryPath: '/nonexistent/opencode',
      timeoutMs: 60000,
      workingDirectory: '/tmp',
    } as OpencodeSettings);
    mockExecFileSync.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
    });
    const result = await fetchProPublicaGrants('test', testDeps);
    expect(result).toEqual({ grants: [], unavailable: true });
  });
});
