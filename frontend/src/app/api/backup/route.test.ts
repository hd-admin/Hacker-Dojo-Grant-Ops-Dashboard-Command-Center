/**
 * Backup API Route Tests
 *
 * Tests the /api/backup GET route for exporting backup snapshots.
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
import type { Grant } from '../../../../../shared/types';
import { defaultOpencodeSettings, defaultProfile } from '../../../../../shared/seed-data';
import { NextRequest } from 'next/server';
import { GET } from './route';

function createMockRequest(url = 'http://localhost:3000/api/backup'): NextRequest {
  return { url, nextUrl: new URL(url) } as NextRequest;
}

function createGrant(id: string): Grant {
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
    tags: ['Test'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-01-01',
  };
}

describe('/api/backup route', () => {
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

  it('exports a backup snapshot with grants, profile, and settings', async () => {
    await repository.addGrant(createGrant('grant-1'));
    await repository.addGrant(createGrant('grant-2'));
    await repository.updateOrgProfile(defaultProfile);
    await repository.updateOpencodeSettings(defaultOpencodeSettings);

    const response = await GET(createMockRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.manifest).toBeDefined();
    expect(data.manifest.version).toBe('1');
    expect(data.manifest.grantCount).toBe(2);
    expect(data.manifest.createdAt).toBeDefined();
    expect(data.grants).toHaveLength(2);
    expect(data.grants[0].id).toBe('grant-1');
    expect(data.grants[1].id).toBe('grant-2');
    expect(data.profile.legalName).toBe(defaultProfile.legalName);
    expect(data.opencodeSettings.binaryPath).toBe(defaultOpencodeSettings.binaryPath);
    expect(data.persistedData).toBeDefined();
  });

  it('includes content-disposition header with timestamp', async () => {
    await repository.addGrant(createGrant('grant-1'));

    const response = await GET(createMockRequest());
    expect(response.status).toBe(200);
    const contentDisposition = response.headers.get('content-disposition');
    expect(contentDisposition).toMatch(/^attachment; filename=grant-ops-backup-/);
  });

  it('exports empty backup when no data exists', async () => {
    const response = await GET(createMockRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.manifest.grantCount).toBe(0);
    expect(data.grants).toEqual([]);
  });
});
