import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, loadProfile, withTempDataDir } from './grant-ops-persistence';
import { clearDatabase, getSqliteState, readPersistedData } from './grant-ops-sqlite';
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

  it('registers sqlite shutdown hooks', () => {
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
    expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
  });
});
