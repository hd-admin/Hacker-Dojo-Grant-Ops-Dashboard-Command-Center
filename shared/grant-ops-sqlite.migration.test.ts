import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, loadProfile, withTempDataDir } from './grant-ops-persistence';
import {
  CURRENT_SCHEMA_VERSION,
  clearDatabase,
  getCurrentSchemaVersion,
  getSqliteState,
  readPersistedData,
  readGrants,
  resetSqliteCache,
  runMigrations,
  setSchemaVersion,
  writeGrants,
  writePersistedData,
} from './grant-ops-sqlite';
import { defaultProfile } from './seed-data';
import type { Grant, Source } from './types';

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

  it('fresh database bootstrap creates schema_version row at CURRENT_SCHEMA_VERSION', async () => {
    tempDataDir = await withTempDataDir();
    const state = getSqliteState(tempDataDir.dataDir);

    await clearDatabase(state);

    // Bootstrap fresh database via readPersistedData which triggers ensureBootstrapped
    await readPersistedData(state);

    // Verify schema_version row exists at CURRENT_SCHEMA_VERSION
    expect(getCurrentSchemaVersion(state)).toBe(CURRENT_SCHEMA_VERSION);

    // Verify re-running migrations is stable
    const result = runMigrations(state);
    expect(result.success).toBe(true);
    expect(result.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(getCurrentSchemaVersion(state)).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('re-running migration at current version is idempotent', async () => {
    tempDataDir = await withTempDataDir();
    const state = getSqliteState(tempDataDir.dataDir);

    // Bootstrap database first
    await readPersistedData(state);
    expect(getCurrentSchemaVersion(state)).toBe(CURRENT_SCHEMA_VERSION);

    // Run migrations again at current version - should be stable
    const result1 = runMigrations(state);
    expect(result1.success).toBe(true);
    expect(result1.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(getCurrentSchemaVersion(state)).toBe(CURRENT_SCHEMA_VERSION);

    // Run a second time to confirm idempotency
    const result2 = runMigrations(state);
    expect(result2.success).toBe(true);
    expect(result2.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(getCurrentSchemaVersion(state)).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('v1 database upgrades to CURRENT_SCHEMA_VERSION without losing existing data', async () => {
    tempDataDir = await withTempDataDir();
    const state = getSqliteState(tempDataDir.dataDir);

    // Bootstrap at current version and write test data (simulating a populated database)
    const existingGrants: Grant[] = [
      {
        id: 'grant-1',
        title: 'Existing Grant 1',
        funder: 'Funder 1',
        funderShort: 'F1',
        award: '$10,000',
        awardSort: 10000,
        deadline: '2026-06-01',
        daysOut: 30,
        fit: 75,
        tags: ['Education'],
        status: 'matched',
        statusLabel: 'Matched',
      },
      {
        id: 'grant-2',
        title: 'Existing Grant 2',
        funder: 'Funder 2',
        funderShort: 'F2',
        award: '$20,000',
        awardSort: 20000,
        deadline: '2026-07-01',
        daysOut: 60,
        fit: 85,
        tags: ['Community'],
        status: 'draft',
        statusLabel: 'Draft',
      },
    ];
    const existingSources: Source[] = [
      {
        id: 'source-1',
        name: 'Existing Source 1',
        url: 'https://example.com/source1',
        type: 'website',
        createdAt: '2026-01-01T00:00:00.000Z',
        isActive: true,
      },
    ];

    await readPersistedData(state);
    await writeGrants(state, existingGrants);
    const preMigrationPersisted = await readPersistedData(state);
    await writePersistedData(state, {
      ...preMigrationPersisted,
      sources: existingSources,
    });
    expect(getCurrentSchemaVersion(state)).toBe(CURRENT_SCHEMA_VERSION);

    // Step 2: Simulate a v1 database by manually downgrading schema_version.
    // This mimics a database created with schema v1 (before schema_version tracking existed).
    // After this, hasAnyRows will still return true (data exists in grants/sources tables),
    // so ensureBootstrapped will NOT re-seed -- data is preserved.
    resetSqliteCache(state.dataDir);
    setSchemaVersion(state, 1);
    expect(getCurrentSchemaVersion(state)).toBe(1);

    // Step 3: Re-bootstrapping detects stale schema_version and upgrades without data loss.
    // Since hasAnyRows=true (data exists), the bootstrap will NOT seed default state;
    // it only runs migrations (adds new tables) and bumps schema_version.
    const postMigrationPersisted = await readPersistedData(state);
    expect(getCurrentSchemaVersion(state)).toBe(CURRENT_SCHEMA_VERSION);

    // Step 4: Verify all original grant and source data survived the v1→v2 upgrade.
    const postMigrationGrants = await readGrants(state);
    expect(postMigrationGrants.length).toBe(2);
    expect(postMigrationGrants[0].id).toBe('grant-1');
    expect(postMigrationGrants[1].id).toBe('grant-2');
    expect(postMigrationPersisted.sources.length).toBe(1);
    expect(postMigrationPersisted.sources[0].id).toBe('source-1');

    // Step 5: Verify runMigrations is idempotent at current version
    const result = runMigrations(state);
    expect(result.success).toBe(true);
    expect(result.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(getCurrentSchemaVersion(state)).toBe(CURRENT_SCHEMA_VERSION);

    // Step 6: Data still intact after migration re-run
    const finalGrants = await readGrants(state);
    expect(finalGrants.length).toBe(2);
    const finalPersisted = await readPersistedData(state);
    expect(finalPersisted.sources.length).toBe(1);
  });
});
