/**
 * Restore API Route Tests
 *
 * Tests the /api/restore POST route for importing backup snapshots.
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
} from '../../../../../shared/grant-ops-persistence';
import * as repository from '../../../server/grant-ops/repository';
import type { Grant, OrganizationProfile, OpencodeSettings } from '../../../../../shared/types';
import { defaultOpencodeSettings, defaultProfile } from '../../../../../shared/seed-data';
import { POST } from './route';

function createGrant(id: string, title: string): Grant {
  return {
    id,
    title,
    funder: 'Test Funder',
    funderShort: 'TF',
    award: '$50,000',
    awardSort: 50000,
    deadline: '2026-12-31',
    daysOut: 200,
    fit: 80,
    tags: ['Test'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-01-01',
  };
}

function makeRestoreRequest(body: unknown) {
  return new Request('http://localhost/api/restore', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildSnapshot(grants: Grant[], profile: OrganizationProfile, opencodeSettings: OpencodeSettings) {
  return {
    manifest: {
      version: '1',
      createdAt: new Date().toISOString(),
      grantCount: grants.length,
      sourceCount: 0,
      documentCount: 0,
      hasDocumentFiles: false,
    },
    grants,
    profile,
    opencodeSettings,
    persistedData: {
      sources: [],
      crawlRuns: [],
      draftArtifacts: [],
      revisionRequests: [],
      approvalRecords: [],
      submissionRecords: [],
      followUps: [],
      opencodeSettings,
      notifications: [],
      tasks: [],
      documents: [],
      lastSync: new Date().toISOString(),
    },
    documents: [],
  };
}

describe('/api/restore route', () => {
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

  it('rejects invalid backup payload with 400', async () => {
    const response = await POST(makeRestoreRequest(null) as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid backup payload/i);
  });

  it('rejects non-object payload with 400', async () => {
    const response = await POST(makeRestoreRequest('invalid') as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid backup payload/i);
  });

  it('rejects empty object payload (missing manifest)', async () => {
    const response = await POST(makeRestoreRequest({}) as never);
    // This will throw during importBackupSnapshot because manifest is missing
    // The route catches and returns 500
    expect(response.status).toBe(500);
  });

  it('restores grants, profile, and settings from a valid snapshot', async () => {
    const grant = createGrant('restored-grant', 'Restored Grant');
    const snapshot = buildSnapshot([grant], defaultProfile, defaultOpencodeSettings);

    const response = await POST(makeRestoreRequest(snapshot) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify grants were restored
    const grants = await repository.getGrants();
    expect(grants).toHaveLength(1);
    expect(grants[0]?.title).toBe('Restored Grant');

    // Verify profile was restored
    const profile = await repository.getOrgProfile();
    expect(profile?.legalName).toBe(defaultProfile.legalName);

    // Verify settings were restored
    const settings = await repository.getOpencodeSettings();
    expect(settings?.binaryPath).toBe(defaultOpencodeSettings.binaryPath);
  });

  it('restores multiple grants correctly', async () => {
    const grants = [
      createGrant('grant-a', 'Grant A'),
      createGrant('grant-b', 'Grant B'),
      createGrant('grant-c', 'Grant C'),
    ];
    const snapshot = buildSnapshot(grants, defaultProfile, defaultOpencodeSettings);

    const response = await POST(makeRestoreRequest(snapshot) as never);
    expect(response.status).toBe(200);

    const restored = await repository.getGrants();
    expect(restored).toHaveLength(3);
    const titles = restored.map((g) => g.title);
    expect(titles).toContain('Grant A');
    expect(titles).toContain('Grant B');
    expect(titles).toContain('Grant C');
  });

  it('rejects malformed JSON body', async () => {
    const response = await POST(
      new Request('http://localhost/api/restore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not valid json',
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid backup payload/i);
  });
});
