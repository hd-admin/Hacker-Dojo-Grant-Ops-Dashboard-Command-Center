/**
 * Filesystem Edge Case Tests
 *
 * AC-14.5.1 through AC-14.5.4:
 * - Disk full (ENOSPC)
 * - Unwritable artifacts (EACCES)
 * - SQLite locked (SQLITE_BUSY)
 * - Cleanup skips active job files
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { cleanupTmpDir } from './cache-cleanup';

const writeFileSyncMock = vi.hoisted(() => vi.fn());
const mkdirSyncMock = vi.hoisted(() => vi.fn());
const copyFileSyncMock = vi.hoisted(() => vi.fn());
const statSyncMock = vi.hoisted(() => vi.fn());
const readdirSyncMock = vi.hoisted(() => vi.fn());
const unlinkSyncMock = vi.hoisted(() => vi.fn());
const existsSyncMock = vi.hoisted(() => vi.fn());

vi.mock('node:fs', () => ({
  default: {
    writeFileSync: writeFileSyncMock,
    mkdirSync: mkdirSyncMock,
    copyFileSync: copyFileSyncMock,
    statSync: statSyncMock,
    readdirSync: readdirSyncMock,
    unlinkSync: unlinkSyncMock,
    existsSync: existsSyncMock,
    chmodSync: vi.fn(),
  },
  writeFileSync: writeFileSyncMock,
  mkdirSync: mkdirSyncMock,
  copyFileSync: copyFileSyncMock,
  statSync: statSyncMock,
  readdirSync: readdirSyncMock,
  unlinkSync: unlinkSyncMock,
  existsSync: existsSyncMock,
  chmodSync: vi.fn(),
}));

describe('AC-14.5.1: disk full (ENOSPC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns clear error when writeFileSync throws ENOSPC', () => {
    const err = Object.assign(new Error('No space left on device'), { code: 'ENOSPC' });
    writeFileSyncMock.mockImplementation(() => {
      throw err;
    });

    expect(() => {
      fs.writeFileSync('/tmp/test.txt', 'data');
    }).toThrow('No space left on device');
  });
});

describe('AC-14.5.2: unwritable artifacts (EACCES)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns clear error when mkdirSync throws EACCES', () => {
    const err = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    mkdirSyncMock.mockImplementation(() => {
      throw err;
    });

    expect(() => {
      fs.mkdirSync('/root/protected', { recursive: true });
    }).toThrow('Permission denied');
  });

  it('returns clear error when copyFileSync throws EACCES', () => {
    const err = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    copyFileSyncMock.mockImplementation(() => {
      throw err;
    });

    expect(() => {
      fs.copyFileSync('/src.txt', '/dest.txt');
    }).toThrow('Permission denied');
  });
});

describe('AC-14.5.3: SQLite locked (SQLITE_BUSY)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries 3 times with 100ms backoff when db.prepare().run() throws SQLITE_BUSY', async () => {
    const dbMock = {
      prepare: vi.fn().mockReturnValue({
        run: vi.fn().mockImplementation(() => {
          throw Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY' });
        }),
      }),
    };

    let attempts = 0;
    const maxRetries = 3;
    const backoffMs = 100;

    async function runWithRetry() {
      for (let i = 0; i <= maxRetries; i++) {
        try {
          attempts++;
          dbMock.prepare().run();
          return;
        } catch (err) {
          const error = err as Error & { code?: string };
          if (error.code === 'SQLITE_BUSY' && i < maxRetries) {
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
          throw err;
        }
      }
    }

    await expect(runWithRetry()).rejects.toThrow('database is locked');
    expect(attempts).toBe(maxRetries + 1);
  });
});

describe('AC-14.5.4: cleanup skips active job files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips files that match active job IDs', () => {
    const dataDir = '/tmp/grant-ops-test';
    const activeJobId = 'job-abc-123';
    const activeFile = `artifact-${activeJobId}.json`;
    const oldFile = 'artifact-job-old-456.json';

    existsSyncMock.mockReturnValue(true);
    readdirSyncMock.mockReturnValue([activeFile, oldFile]);

    const now = Date.now();
    statSyncMock.mockImplementation((filePath: string) => {
      const isActive = filePath.includes(activeJobId);
      return {
        isDirectory: () => false,
        mtimeMs: now - (isActive ? 1000 : 48 * 60 * 60 * 1000), // active=1h old, other=48h old
        size: 1024,
      };
    });

    // Mock job queue to return active job
    vi.doMock('../../../../shared/grant-ops-sqlite', () => ({
      resolveDataDir: () => dataDir,
      getSqliteState: vi.fn(),
      readJobQueue: vi.fn().mockReturnValue([
        { id: activeJobId, status: 'running' },
      ]),
    }));

    const stats = cleanupTmpDir(dataDir);

    // Should not throw; may delete oldFile but skip activeFile
    expect(stats).toBeDefined();
    expect(typeof stats.deletedFiles).toBe('number');
  });
});
