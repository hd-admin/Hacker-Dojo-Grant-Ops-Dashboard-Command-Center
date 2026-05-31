/**
 * Backup Service Tests
 *
 * Tests backup creation, checksum verification, and restore flow.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import {
  invalidateCache,
  withTempDataDir,
} from '../../../../shared/grant-ops-persistence';
import * as repository from '../../server/grant-ops/repository';
import type { Grant } from '../../../../shared/types';
import { defaultProfile } from '../../../../shared/seed-data';
import {
  createBackupZip,
  exportBackupSnapshot,
  importBackupFromZip,
  importBackupSnapshot,
  recordBackupVerification,
  verifyBackupZip,
} from '../../server/grant-ops/backup-service';
import {
  createDependencies,
  resetDependencies,
  setDependencies,
} from '../../server/grant-ops/dependencies';

function createGrant(id: string): Grant {
  return {
    id,
    title: `Backup Test Grant ${id}`,
    funder: 'Backup Test Funder',
    funderShort: 'BTF',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-12-31',
    daysOut: 200,
    fit: 85,
    tags: ['Test', 'Backup'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-01-01',
  };
}

describe('backup-service', () => {
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

  describe('exportBackupSnapshot', () => {
    it('creates a snapshot with grants and profile', async () => {
      await repository.addGrant(createGrant('grant-a'));
      await repository.addGrant(createGrant('grant-b'));
      await repository.updateOrgProfile(defaultProfile);

      const snapshot = await exportBackupSnapshot();

      expect(snapshot.manifest.version).toBe('1');
      expect(snapshot.manifest.grantCount).toBe(2);
      expect(snapshot.manifest.createdAt).toBeDefined();
      expect(snapshot.grants).toHaveLength(2);
      expect(snapshot.grants[0]!.id).toBe('grant-a');
      expect(snapshot.grants[1]!.id).toBe('grant-b');
      expect(snapshot.profile.legalName).toBe(defaultProfile.legalName);
    });

    it('handles empty state gracefully', async () => {
      const snapshot = await exportBackupSnapshot();

      expect(snapshot.manifest.grantCount).toBe(0);
      expect(snapshot.grants).toEqual([]);
      expect(snapshot.documents).toEqual([]);
    });
  });

  describe('createBackupZip', () => {
    it('creates a valid zip file with SHA-256 checksum', async () => {
      await repository.addGrant(createGrant('grant-zip'));
      await repository.updateOrgProfile(defaultProfile);

      const snapshot = await exportBackupSnapshot();
      const { zipPath, checksum } = await createBackupZip(snapshot);

      await expect(fs.access(zipPath)).resolves.toBeUndefined();

      const checksumPath = `${zipPath}.sha256`;
      await expect(fs.access(checksumPath)).resolves.toBeUndefined();

      const zipBuffer = await fs.readFile(zipPath);
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      const entryNames: string[] = [];
      entries.forEach((e) => { entryNames.push(e.entryName); });

      expect(entryNames).toContain('manifest.json');
      expect(entryNames).toContain('grants.json');
      expect(entryNames).toContain('profile.json');
      expect(entryNames).toContain('opencode-settings.json');
      expect(entryNames).toContain('persisted-data.json');

      const content = await fs.readFile(checksumPath, 'utf-8');
      expect(content).toContain(checksum);
      expect(content).toContain(path.basename(zipPath));
    });

    it('produces a valid 64-character hex checksum', async () => {
      await repository.addGrant(createGrant('grant-cksum'));
      const snapshot = await exportBackupSnapshot();
      const { checksum } = await createBackupZip(snapshot);

      expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('verifyBackupZip', () => {
    it('verifies a valid backup zip', async () => {
      await repository.addGrant(createGrant('grant-verify'));
      const snapshot = await exportBackupSnapshot();
      const { zipPath } = await createBackupZip(snapshot);

      const checksumPath = `${zipPath}.sha256`;
      const isValid = await verifyBackupZip(zipPath, checksumPath);
      expect(isValid).toBe(true);
    });

    it('rejects a tampered backup', async () => {
      await repository.addGrant(createGrant('grant-tamper'));
      const snapshot = await exportBackupSnapshot();
      const { zipPath } = await createBackupZip(snapshot);

      const original = await fs.readFile(zipPath);
      const tampered = Buffer.from(original);
      tampered[50] = tampered[50]! ^ 0xFF;
      await fs.writeFile(zipPath, tampered);

      const checksumPath = `${zipPath}.sha256`;
      const isValid = await verifyBackupZip(zipPath, checksumPath);
      expect(isValid).toBe(false);
    });

    it('returns false for missing checksum file', async () => {
      await repository.addGrant(createGrant('grant-missing'));
      const snapshot = await exportBackupSnapshot();
      const { zipPath } = await createBackupZip(snapshot);

      const isValid = await verifyBackupZip(zipPath, `${zipPath}.nonexistent`);
      expect(isValid).toBe(false);
    });
  });

  describe('importBackupFromZip', () => {
    it('restores grants and profile from a zip backup', async () => {
      await repository.addGrant(createGrant('grant-import'));
      await repository.updateOrgProfile(defaultProfile);

      const snapshot = await exportBackupSnapshot();
      const { zipPath } = await createBackupZip(snapshot);

      const zipBuffer = await fs.readFile(zipPath);

      await fs.rm(tempDataDir.dataDir, { recursive: true }).catch(() => {});
      invalidateCache();

      await fs.mkdir(path.dirname(zipPath), { recursive: true });
      await fs.writeFile(zipPath, zipBuffer);

      await importBackupFromZip(zipPath);

      invalidateCache();
      const deps = createDependencies();
      const grants = await deps.repository.getGrants();
      const profile = await deps.repository.getOrgProfile();

      expect(grants).toHaveLength(1);
      expect(grants[0]!.id).toBe('grant-import');
      expect(profile!.legalName).toBe(defaultProfile.legalName);
    });

    it('rejects invalid backup format', async () => {
      await expect(importBackupFromZip('/nonexistent/path.zip')).rejects.toThrow();
    });
  });

  describe('importBackupSnapshot', () => {
    it('restores snapshot data correctly', async () => {
      await repository.addGrant(createGrant('grant-snap'));
      await repository.updateOrgProfile(defaultProfile);

      const snapshot = await exportBackupSnapshot();
      snapshot.grants[0]!.title = 'Modified Title';

      await importBackupSnapshot(snapshot);

      invalidateCache();
      const deps = createDependencies();
      const grants = await deps.repository.getGrants();

      expect(grants).toHaveLength(1);
      expect(grants[0]!.title).toBe('Modified Title');
    });
  });

  describe('recordBackupVerification', () => {
    it('updates backup freshness record', async () => {
      await repository.addGrant(createGrant('grant-record'));
      const snapshot = await exportBackupSnapshot();

      await recordBackupVerification(snapshot);

      invalidateCache();
      const deps = createDependencies();
      const freshness = await deps.loadBackupFreshness();

      expect(freshness.isStale).toBe(false);
      expect(freshness.lastBackupAt).toBeDefined();
      expect(freshness.lastBackupVerification).toBeDefined();
    });
  });
});
