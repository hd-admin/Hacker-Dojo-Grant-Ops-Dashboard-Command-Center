import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, loadProfile, withTempDataDir } from './grant-ops-persistence';
import {
  CURRENT_SCHEMA_VERSION,
  clearDatabase,
  getCurrentSchemaVersion,
  getSqliteState,
  readPersistedData,
  runMigrations,
  setSchemaVersion,
} from './grant-ops-sqlite';
import { defaultProfile } from './seed-data';

describe('shared/grant-ops-sqlite migration bootstrap', () => {
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

  it('starts a fresh data directory without seeded operational records', async () => {
    tempDataDir = await withTempDataDir();
    const state = getSqliteState(tempDataDir.dataDir);

    await clearDatabase(state);

    const persisted = await readPersistedData(state);
    const profile = await loadProfile();

    expect(persisted.sources).toEqual([]);
    expect(persisted.crawlRuns).toEqual([]);
    expect(persisted.draftArtifacts).toEqual([]);
    expect(persisted.notifications).toEqual([]);
    expect(persisted.tasks).toEqual([]);
    expect(profile.legalName).toBe(defaultProfile.legalName);
  });

  it('upgrades old schema versions during migration bootstrap', async () => {
    tempDataDir = await withTempDataDir();
    const state = getSqliteState(tempDataDir.dataDir);

    setSchemaVersion(state, CURRENT_SCHEMA_VERSION - 1);

    const result = runMigrations(state, {
      applyMigration: (currentVersion) => {
        expect(currentVersion).toBe(CURRENT_SCHEMA_VERSION - 1);
        setSchemaVersion(state, CURRENT_SCHEMA_VERSION);
      },
    });

    expect(result.success).toBe(true);
    expect(result.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(getCurrentSchemaVersion(state)).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('returns migration failures without masking the current version', async () => {
    tempDataDir = await withTempDataDir();
    const state = getSqliteState(tempDataDir.dataDir);

    setSchemaVersion(state, CURRENT_SCHEMA_VERSION - 1);

    const result = runMigrations(state, {
      applyMigration: () => {
        throw new Error('forced migration failure');
      },
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('forced migration failure');
    expect(result.version).toBe(CURRENT_SCHEMA_VERSION - 1);
    expect(getCurrentSchemaVersion(state)).toBe(CURRENT_SCHEMA_VERSION - 1);
  });

  it('registers sqlite shutdown hooks', () => {
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
    expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
  });
});
