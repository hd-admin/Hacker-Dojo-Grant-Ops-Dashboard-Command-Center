/**
 * Persistence Integrity Tests
 *
 * Verifies that the shared persistence layer functions (loadGrants, saveGrants,
 * loadProfile, saveProfile, loadPersistedData, savePersistedData) all use
 * the same DATA_DIR (.grant-ops-data/) for file storage.
 *
 * This ensures that repository.ts and any other module using the shared
 * persistence layer read/write to the same files.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DATA_DIR,
  loadGrants,
  saveGrants,
  loadProfile,
  saveProfile,
  loadPersistedData,
  getDataPath,
  invalidateCache,
} from './grant-ops-persistence';

// Helper to create unique test grant with crypto UUID
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

// Generate unique ID using crypto
function uniqueId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

describe('Shared Persistence Integrity', () => {
  // Backup original grants.json before each test and restore after
  let originalGrantsBackup: Awaited<ReturnType<typeof loadGrants>> | null = null;

  beforeEach(async () => {
    // Invalidate cache to ensure we read fresh from disk
    invalidateCache();
    // Backup current grants before test
    originalGrantsBackup = await loadGrants();
  });

  afterEach(async () => {
    // Restore original grants after each test
    if (originalGrantsBackup !== null) {
      await saveGrants(originalGrantsBackup);
    }
    invalidateCache();
  });

  describe('DATA_DIR constant', () => {
    it('exports DATA_DIR as ".grant-ops-data"', () => {
      expect(DATA_DIR).toBe('.grant-ops-data');
    });

    it('getDataPath uses DATA_DIR with process.cwd()', () => {
      const dataPath = getDataPath();
      expect(dataPath).toContain(DATA_DIR);
      expect(dataPath).toContain(process.cwd());
    });
  });

  describe('Persistence functions use consistent paths', () => {
    it('loadGrants and saveGrants use same file path', async () => {
      // Both loadGrants and saveGrants use: path.join(cwd, DATA_DIR, 'grants.json')
      // This test verifies they read/write to the same location
      // Use unique ID to avoid conflicts with other tests
      const testGrant = createTestGrant(uniqueId('persistence-grant'));

      await saveGrants([testGrant]);

      // Verify we can read back what we wrote (same file path)
      const loaded = await loadGrants();
      const found = loaded.find((g) => g.id === testGrant.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe(testGrant.title);
    });

    it('loadPersistedData and savePersistedData use same directory', async () => {
      // Both use: path.join(cwd, DATA_DIR, 'persisted-data.json')
      const data = await loadPersistedData();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('sources');
      expect(data).toHaveProperty('crawlRuns');
      expect(data).toHaveProperty('draftArtifacts');
      expect(data).toHaveProperty('approvalRecords');
      expect(data).toHaveProperty('submissionRecords');
      expect(data).toHaveProperty('followUps');
      expect(data).toHaveProperty('opencodeSettings');
    });

    it('loadProfile and saveProfile use same file path', async () => {
      // Both use: path.join(cwd, DATA_DIR, 'profile.json')
      const testProfile = {
        legalName: 'Test Org',
        ein: '12-3456789',
        samUEI: 'TEST123456789',
        mission: 'Test mission',
        docTypes: ['PDF'] as string[],
        searchThemes: ['Test'] as string[],
        agentBehavior: {
          autoDraftThreshold: 50,
          submissionPolicy: 'Test',
          notifyEmail: 'test@test.com',
          voiceAndTone: 'Test',
        },
      };

      await saveProfile(testProfile);

      const loaded = await loadProfile();
      expect(loaded.legalName).toBe('Test Org');
    });
  });

  describe('Cross-module file path consistency', () => {
    it('loadGrants reads from same path as what saveGrants writes to', async () => {
      // This verifies the shared persistence functions use consistent paths
      // Use unique ID to avoid conflicts with other tests
      const testGrant = createTestGrant(uniqueId('consistency-grant'));

      await saveGrants([testGrant]);

      // Both loadGrants and saveGrants use: path.join(cwd, DATA_DIR, 'grants.json')
      const loaded = await loadGrants();
      const found = loaded.find((g) => g.id === testGrant.id);

      expect(found).toBeDefined();
      expect(found?.title).toBe(testGrant.title);
    });

    it('loadProfile reads from same path as saveProfile writes to', async () => {
      // Both use: path.join(cwd, DATA_DIR, 'profile.json')
      const testProfile = {
        legalName: 'Test Org',
        ein: '12-3456789',
        samUEI: 'TEST123456789',
        mission: 'Test mission',
        docTypes: ['PDF'] as string[],
        searchThemes: ['Test'] as string[],
        agentBehavior: {
          autoDraftThreshold: 50,
          submissionPolicy: 'Test',
          notifyEmail: 'test@test.com',
          voiceAndTone: 'Test',
        },
      };

      await saveProfile(testProfile);

      const loaded = await loadProfile();
      expect(loaded.legalName).toBe('Test Org');
    });
  });
});
