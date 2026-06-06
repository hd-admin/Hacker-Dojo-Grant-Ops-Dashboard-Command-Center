import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  resolveDataDir,
  getSqliteState,
  openDatabase,
  resetSqliteCache,
  getCurrentSchemaVersion,
  runMigrations,
  CURRENT_SCHEMA_VERSION,
  truncateDatabase,
} from './grant-ops-sqlite';
import { withTempDataDir } from './grant-ops-persistence';

describe('grant-ops-sqlite', () => {
  let temp: Awaited<ReturnType<typeof withTempDataDir>>;
  let state: ReturnType<typeof getSqliteState>;

  beforeAll(async () => {
    temp = await withTempDataDir();
    state = getSqliteState(temp.dataDir);
  });

  afterAll(async () => {
    resetSqliteCache(temp.dataDir);
    await temp.cleanup();
  });

  it('resolveDataDir returns a valid path', () => {
    const dir = resolveDataDir();
    expect(typeof dir).toBe('string');
    expect(dir.length).toBeGreaterThan(0);
  });

  it('getSqliteState returns correct paths', () => {
    expect(state.dataDir).toBe(temp.dataDir);
    expect(state.dbPath).toContain('grant-ops.sqlite');
    expect(state.documentsDir).toContain('documents');
  });

  it('openDatabase creates a valid database', () => {
    const db = openDatabase(state);
    expect(db).toBeDefined();

    // Verify we can run a simple query
    const result = db.prepare('SELECT 1 as test').get() as { test: number };
    expect(result.test).toBe(1);

    db.close();
    resetSqliteCache(temp.dataDir);
  });

  it('runMigrations returns success', () => {
    const result = runMigrations(state);
    expect(result.success).toBe(true);
    expect(result.version).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('getCurrentSchemaVersion returns a number', () => {
    const version = getCurrentSchemaVersion(state);
    expect(typeof version).toBe('number');
    expect(version).toBeGreaterThanOrEqual(0);
  });

  it('truncateDatabase clears all tables', () => {
    truncateDatabase(state);
    const db = openDatabase(state);

    // Verify grants table is empty
    const grantsCount = db.prepare('SELECT COUNT(*) as count FROM grants').get() as {
      count: number;
    };
    expect(grantsCount.count).toBe(0);

    db.close();
    resetSqliteCache(temp.dataDir);
  });
});
