import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDataDir,
  getDATA_DIR,
  getDataPath,
  loadGrants,
  saveGrants,
  loadProfile,
  saveProfile,
  loadOpencodeSettings,
  saveOpencodeSettings,
  invalidateCache,
  withTempDataDir,
  resetPersistentStateForTests,
} from './grant-ops-persistence';

describe('grant-ops-persistence', () => {
  let temp: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    temp = await withTempDataDir();
    await resetPersistentStateForTests();
  });

  afterEach(async () => {
    await temp.cleanup();
  });

  it('getDataDir returns a non-empty string', () => {
    expect(typeof getDataDir()).toBe('string');
    expect(getDataDir().length).toBeGreaterThan(0);
  });

  it('getDATA_DIR matches getDataDir', () => {
    expect(getDATA_DIR()).toBe(getDataDir());
  });

  it('getDataPath ends with grant-ops.sqlite', () => {
    expect(getDataPath()).toMatch(/grant-ops\.sqlite$/);
  });

  it('loadGrants returns seed grants after reset', async () => {
    const grants = await loadGrants();
    expect(grants.length).toBeGreaterThan(0);
    expect(grants[0].id).toBeDefined();
  });

  it('saveGrants persists and loadGrants reads back', async () => {
    const original = await loadGrants();
    const modified = original.map((g) => ({ ...g, title: `${g.title}-test` }));
    await saveGrants(modified);
    const loaded = await loadGrants();
    expect(loaded[0].title).toContain('-test');
  });

  it('loadProfile returns a profile after reset', async () => {
    const profile = await loadProfile();
    expect(profile).toBeDefined();
    expect(typeof profile.legalName).toBe('string');
  });

  it('saveProfile persists and loadProfile reads back', async () => {
    const updated = { ...(await loadProfile()), operatorName: 'Test Operator' };
    await saveProfile(updated);
    const loaded = await loadProfile();
    expect(loaded.operatorName).toBe('Test Operator');
  });

  it('loadOpencodeSettings returns defaults after reset', async () => {
    const settings = await loadOpencodeSettings();
    expect(settings).toBeDefined();
    expect(typeof settings.isConfigured).toBe('boolean');
  });

  it('saveOpencodeSettings persists and loadOpencodeSettings reads back', async () => {
    const updated = { ...(await loadOpencodeSettings()), isConfigured: true };
    await saveOpencodeSettings(updated);
    const loaded = await loadOpencodeSettings();
    expect(loaded.isConfigured).toBe(true);
  });

  it('invalidateCache does not throw', () => {
    expect(() => invalidateCache()).not.toThrow();
  });

  it('withTempDataDir provides isolated temp directory', async () => {
    const t = await withTempDataDir();
    expect(t.dataDir).toBeDefined();
    expect(typeof t.cleanup).toBe('function');
    await t.cleanup();
  });
});
