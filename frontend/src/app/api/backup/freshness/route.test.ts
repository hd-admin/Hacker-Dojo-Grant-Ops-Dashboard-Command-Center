/**
 * Backup Freshness API Route Tests
 *
 * Tests the /api/backup/freshness GET route.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDependencies,
  resetDependencies,
  setDependencies,
} from '@/server/grant-ops/dependencies';
import {
  invalidateCache,
  withTempDataDir,
} from '../../../../../../shared/grant-ops-persistence';
import type { BackupFreshnessStatus } from '../../../../../../shared/types';
import { GET } from './route';

describe('/api/backup/freshness route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(createDependencies());
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns default backup freshness status', async () => {
    const response = await GET();
    const data = (await response.json()) as BackupFreshnessStatus;

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('lastBackupAt');
    expect(data).toHaveProperty('isStale');
    expect(data).toHaveProperty('lastBackupVerification');
    expect(data).toHaveProperty('lastRestoreVerification');
  });

  it('returns backup freshness status with expected structure', async () => {
    const response = await GET();
    const data = (await response.json()) as BackupFreshnessStatus;

    expect(response.status).toBe(200);
    expect(typeof data.isStale).toBe('boolean');
    // Initially, no backup has been performed
    expect(data.lastBackupAt).toBeNull();
    expect(data.lastBackupVerification).toBeNull();
    expect(data.lastRestoreVerification).toBeNull();
  });
});
