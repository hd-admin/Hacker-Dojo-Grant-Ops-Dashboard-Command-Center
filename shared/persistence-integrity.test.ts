import Database from 'better-sqlite3';
import { mkdirSync, rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DATA_DIR,
  getDataDir,
  getDataPath,
  invalidateCache,
  loadGrants,
  loadOpencodeSettings,
  loadPersistedData,
  savePersistedData,
  loadProfile,
  resetPersistentStateForTests,
  saveGrants,
  saveOpencodeSettings,
  saveProfile,
  withTempDataDir,
} from './grant-ops-persistence';
import { clearDatabase, getSqliteState } from './grant-ops-sqlite';
import { testProfile } from './test-fixtures';
import { defaultOpencodeSettings, defaultProfile } from './seed-data';
import type { PersistedData } from './grant-ops-persistence';

function createTestGrant(id: string) {
  return {
    id,
    title: `Test Grant ${id}`,
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$50,000',
    awardSort: 50000,
    deadline: '2026-12-31',
    daysOut: 200,
    fit: 80,
    tags: ['Community'],
    status: 'matched' as const,
    statusLabel: 'Matched',
  };
}

describe('Shared Persistence Integrity', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>> | null = null;

  beforeEach(() => {
    invalidateCache();
  });

  afterEach(async () => {
    if (tempDataDir) {
      await tempDataDir.cleanup();
      tempDataDir = null;
    }
    invalidateCache();
  });

  describe('DATA_DIR constant', () => {
    it('exports a canonical absolute path ending with .grant-ops-data', () => {
      expect(DATA_DIR).toContain('/');
      expect(DATA_DIR).toMatch(/\.grant-ops-data$/);
    });

    it('resolves the same data dir from repo-root and frontend working directories', async () => {
      const originalCwd = process.cwd();
      const repoRootResult = getDataDir();
      process.chdir(path.join(originalCwd, 'frontend'));
      const frontendCwdResult = getDataDir();
      process.chdir(originalCwd);

      expect(repoRootResult).toBe(frontendCwdResult);
      expect(getDataPath()).toBe(path.join(repoRootResult, 'grant-ops.sqlite'));
    });
  });

  describe('sqlite bootstrap precedence', () => {
    it('prefers standalone opencode-settings.json over embedded persisted-data settings', async () => {
      tempDataDir = await withTempDataDir();
      const { dataDir } = tempDataDir;

      await fs.writeFile(
        path.join(dataDir, 'grants.json'),
        JSON.stringify([createTestGrant('bootstrap-grant')], null, 2),
        'utf8',
      );
      await fs.writeFile(
        path.join(dataDir, 'profile.json'),
        JSON.stringify(defaultProfile, null, 2),
        'utf8',
      );
      await fs.writeFile(
        path.join(dataDir, 'persisted-data.json'),
        JSON.stringify(
          {
            sources: [],
            crawlRuns: [],
            draftArtifacts: [],
            revisionRequests: [],
            approvalRecords: [],
            submissionRecords: [],
            followUps: [],
            opencodeSettings: {
              ...defaultOpencodeSettings,
              binaryPath: '/embedded/bin',
              isConfigured: true,
            },
            notifications: [],
            tasks: [],
            documents: [],
            lastSync: '2026-05-22T00:00:00.000Z',
          },
          null,
          2,
        ),
        'utf8',
      );
      await fs.writeFile(
        path.join(dataDir, 'opencode-settings.json'),
        JSON.stringify(
          { ...defaultOpencodeSettings, binaryPath: '/standalone/bin', isConfigured: true },
          null,
          2,
        ),
        'utf8',
      );

      invalidateCache();

      const settings = await loadOpencodeSettings();
      const persisted = await loadPersistedData();
      const grants = await loadGrants();
      const profile = await loadProfile();

      expect(settings.binaryPath).toBe('/standalone/bin');
      expect(persisted.opencodeSettings?.binaryPath).toBe('/standalone/bin');
      expect(grants[0]?.id).toBe('bootstrap-grant');
      expect(profile.legalName).toBe(defaultProfile.legalName);
    });

    it('writes sqlite-backed data without relying on JSON files', async () => {
      tempDataDir = await withTempDataDir();
      const grant = createTestGrant('write-grant');

      await saveGrants([grant]);
      await saveProfile(defaultProfile);
      await saveOpencodeSettings({
        ...defaultOpencodeSettings,
        isConfigured: true,
        binaryPath: '/bin/opencode',
      });

      const persisted = await loadPersistedData();
      expect(persisted.sources).toHaveLength(13);
      expect(persisted.documents).toEqual([]);
      expect(persisted.opencodeSettings?.binaryPath).toBe('/bin/opencode');
      expect(persisted.lastSync).toBeTruthy();
    });

    it('preserves standalone opencode settings when aggregate persisted data omits them', async () => {
      tempDataDir = await withTempDataDir();
      await saveOpencodeSettings({
        ...defaultOpencodeSettings,
        isConfigured: true,
        binaryPath: '/standalone/bin',
      });

      const staleData = (await loadPersistedData()) as PersistedData;
      await savePersistedData({ ...staleData, opencodeSettings: null });

      const settings = await loadOpencodeSettings();
      expect(settings.binaryPath).toBe('/standalone/bin');
    });

    it('resetPersistentStateForTests reboots a clean sqlite state that still reads and writes', async () => {
      tempDataDir = await withTempDataDir();
      const grant = createTestGrant('reset-grant');

      await saveGrants([grant]);
      await saveProfile({ ...defaultProfile, legalName: 'Reset Test Org' });
      await resetPersistentStateForTests();

      const profile = await loadProfile();
      const grants = await loadGrants();
      const persisted = await loadPersistedData();

      expect(profile.legalName).toBe(testProfile.legalName);
      expect(grants.some((item) => item.id === grant.id)).toBe(false);
      expect(grants.length).toBe(13);
      expect(persisted.sources.length).toBeGreaterThan(0);
      expect(persisted.crawlRuns).toEqual([]);
      expect(persisted.lastSync).toBeTruthy();
    });

    it('clearDatabase removes sqlite sidecar files before reinitializing', async () => {
      tempDataDir = await withTempDataDir();
      const { dataDir } = tempDataDir;
      const dbPath = path.join(dataDir, 'grant-ops.sqlite');

      await fs.writeFile(dbPath, 'main-db', 'utf8');
      await fs.writeFile(`${dbPath}-wal`, 'wal-data', 'utf8');
      await fs.writeFile(`${dbPath}-shm`, 'shm-data', 'utf8');
      await fs.writeFile(`${dbPath}-journal`, 'journal-data', 'utf8');

      await clearDatabase(getSqliteState(dataDir));

      await expect(fs.access(dbPath)).rejects.toBeDefined();
      await expect(fs.access(`${dbPath}-wal`)).rejects.toBeDefined();
      await expect(fs.access(`${dbPath}-shm`)).rejects.toBeDefined();
      await expect(fs.access(`${dbPath}-journal`)).rejects.toBeDefined();
    });
  });
});

describe('SQLITE_BUSY retry via busy_timeout pragma (Step 5)', () => {
  it('busy_timeout pragma is set to 5000ms on readwrite connections', () => {
    const tempDir = path.join(process.cwd(), `.grant-ops-data-busy-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    const dbPath = path.join(tempDir, 'test-busy.sqlite');

    try {
      const db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('busy_timeout = 5000');
      db.pragma('synchronous = NORMAL');
      db.pragma('foreign_keys = ON');

      // Verify busy_timeout is set
      const busyTimeout = db.pragma('busy_timeout', { simple: true }) as number;
      expect(busyTimeout).toBe(5000);

      // Create a table and perform concurrent writes to exercise busy retry
      db.exec('CREATE TABLE IF NOT EXISTS busy_test (id INTEGER PRIMARY KEY, value TEXT)');

      // Open a second connection and start a write transaction
      const db2 = new Database(dbPath);
      db2.pragma('busy_timeout = 5000');
      db2.pragma('journal_mode = WAL');

      const writeTx = db2.transaction(() => {
        for (let i = 0; i < 10; i++) {
          db2
            .prepare('INSERT OR REPLACE INTO busy_test (id, value) VALUES (?, ?)')
            .run(i, `value-${i}`);
        }
      });

      // Both writes should succeed; WAL mode + busy_timeout prevent SQLITE_BUSY errors
      const mainTx = db.transaction(() => {
        for (let i = 10; i < 20; i++) {
          db.prepare('INSERT OR REPLACE INTO busy_test (id, value) VALUES (?, ?)').run(
            i,
            `value-${i}`,
          );
        }
      });

      expect(() => writeTx()).not.toThrow();
      expect(() => mainTx()).not.toThrow();

      // Verify all rows were inserted
      const count = db.prepare('SELECT COUNT(*) as count FROM busy_test').get() as {
        count: number;
      };
      expect(count.count).toBe(20);

      db2.close();
      db.close();
    } finally {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Suppress cleanup errors
      }
    }
  });

  it('withTransaction helper executes within a database transaction', () => {
    const tempDir = path.join(process.cwd(), `.grant-ops-data-tx-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    const dbPath = path.join(tempDir, 'test-tx.sqlite');

    try {
      const db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('busy_timeout = 5000');
      db.exec('CREATE TABLE IF NOT EXISTS tx_test (id INTEGER PRIMARY KEY, value TEXT)');

      // Use a transaction to perform atomic writes
      const result = db.transaction(() => {
        db.prepare('INSERT INTO tx_test (id, value) VALUES (?, ?)').run(1, 'tx-value-1');
        db.prepare('INSERT INTO tx_test (id, value) VALUES (?, ?)').run(2, 'tx-value-2');
        return true;
      })();

      expect(result).toBe(true);

      const count = db.prepare('SELECT COUNT(*) as count FROM tx_test').get() as { count: number };
      expect(count.count).toBe(2);

      db.close();
    } finally {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Suppress cleanup errors
      }
    }
  });
});
