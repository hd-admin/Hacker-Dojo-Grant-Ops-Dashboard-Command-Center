/**
 * Profile API Route Tests
 *
 * Tests the /api/profile GET and PUT routes with real route handler invocation.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import { defaultProfile } from '../../../../../shared/seed-data';
import * as repository from '../../../server/grant-ops/repository';
import { GET, PUT } from './route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/profile route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('GET returns persisted profile', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.legalName).toBe(defaultProfile.legalName);
    expect(data.ein).toBe(defaultProfile.ein);
    expect(data.mission).toBe(defaultProfile.mission);
    expect(data.agentBehavior).toBeDefined();
    expect(data.agentBehavior.notifyEmail).toBe(defaultProfile.agentBehavior.notifyEmail);
  });

  it('PUT updates persisted profile and GET returns updated data', async () => {
    const updatedProfile = {
      ...defaultProfile,
      legalName: 'Updated Legal Name',
      mission: 'Updated mission statement for testing',
      agentBehavior: {
        ...defaultProfile.agentBehavior,
        notifyEmail: 'test@example.com',
      },
    };

    const putResponse = await PUT(makeRequest(updatedProfile) as NextRequest);
    expect(putResponse.status).toBe(200);

    const getResponse = await GET();
    const data = await getResponse.json();
    expect(data.legalName).toBe('Updated Legal Name');
    expect(data.mission).toBe('Updated mission statement for testing');
    expect(data.agentBehavior.notifyEmail).toBe('test@example.com');

    // Verify persistence by fetching from repository directly
    const repoProfile = await repository.getOrgProfile();
    expect(repoProfile?.legalName).toBe('Updated Legal Name');
  });

  it('rejects invalid profile with missing required fields', async () => {
    const invalidProfile = {
      legalName: 'Test Org',
      // missing ein, mission, etc.
    };

    const response = await PUT(makeRequest(invalidProfile) as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid profile data/i);
    expect(data.details).toBeDefined();
  });

  it('rejects invalid profile with wrong field types', async () => {
    const invalidProfile = {
      legalName: 12345, // should be string
      ein: '12-3456789',
      samUEI: 'XK7N4HQ2P3M9',
      mission: 'Test mission',
      docTypes: 'not an array', // should be array
      searchThemes: ['theme1'],
      agentBehavior: {
        autoDraftThreshold: 'high', // should be number
        submissionPolicy: 'Human approval required',
        notifyEmail: 'test@example.com',
        voiceAndTone: 'Plain-spoken',
      },
    };

    const response = await PUT(makeRequest(invalidProfile) as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid profile data/i);
  });

  it('rejects invalid agentBehavior field types', async () => {
    const invalidProfile = {
      ...defaultProfile,
      agentBehavior: {
        autoDraftThreshold: 'not a number',
        submissionPolicy: 'Human approval required',
        notifyEmail: 'test@example.com',
        voiceAndTone: 'Plain-spoken',
      },
    };

    const response = await PUT(makeRequest(invalidProfile) as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid profile data/i);
  });

  it('rejects malformed JSON body', async () => {
    const badRequest = new NextRequest('http://localhost/api/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: 'not valid json',
    });

    const response = await PUT(badRequest);
    expect(response.status).toBe(400);
  });
});
