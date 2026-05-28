/**
 * Opencode Settings API Route Tests
 *
 * Tests the /api/opencode-settings GET and PUT routes with real route handler invocation.
 * Covers all failure modes: 200, 400, 404, 500.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import { defaultOpencodeSettings } from '../../../../../shared/seed-data';
import * as repository from '../../../server/grant-ops/repository';
import { GET, PUT } from './route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/opencode-settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/opencode-settings route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  // --- 200 success cases ---

  it('GET returns persisted opencode settings', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.binaryPath).toBe(defaultOpencodeSettings.binaryPath);
    expect(data.workingDirectory).toBe(defaultOpencodeSettings.workingDirectory);
    expect(data.timeoutMs).toBe(defaultOpencodeSettings.timeoutMs);
    expect(data.isConfigured).toBe(defaultOpencodeSettings.isConfigured);
  });

  it('PUT updates persisted settings and GET returns updated data', async () => {
    const updatedSettings = {
      ...defaultOpencodeSettings,
      binaryPath: '/usr/local/bin/opencode',
      workingDirectory: '/home/user/opencode-projects',
      timeoutMs: 120000,
      isConfigured: true,
    };

    const putResponse = await PUT(makeRequest(updatedSettings) as NextRequest);
    expect(putResponse.status).toBe(200);

    const getResponse = await GET();
    const data = await getResponse.json();
    expect(data.binaryPath).toBe('/usr/local/bin/opencode');
    expect(data.workingDirectory).toBe('/home/user/opencode-projects');
    expect(data.timeoutMs).toBe(120000);
    expect(data.isConfigured).toBe(true);

    // Verify persistence by fetching from repository directly
    const repoSettings = await repository.getOpencodeSettings();
    expect(repoSettings?.binaryPath).toBe('/usr/local/bin/opencode');
    expect(repoSettings?.isConfigured).toBe(true);
  });

  // --- 400 validation failure cases ---

  it('rejects invalid settings with missing required fields', async () => {
    const invalidSettings = {
      binaryPath: '/some/path',
      // missing workingDirectory, timeoutMs, isConfigured
    };

    const response = await PUT(makeRequest(invalidSettings) as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid opencode settings/i);
    expect(data.details).toBeDefined();
  });

  it('rejects invalid settings with wrong field types', async () => {
    const invalidSettings = {
      binaryPath: 12345, // should be string
      workingDirectory: '/some/path',
      timeoutMs: '60000', // should be number
      isConfigured: 'yes', // should be boolean
    };

    const response = await PUT(makeRequest(invalidSettings) as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid opencode settings/i);
  });

  it('rejects invalid isConfigured type', async () => {
    const invalidSettings = {
      binaryPath: '/usr/bin/opencode',
      workingDirectory: '/home/user',
      timeoutMs: 60000,
      isConfigured: 'not a boolean',
    };

    const response = await PUT(makeRequest(invalidSettings) as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Invalid opencode settings/i);
  });

  it('rejects malformed JSON body', async () => {
    const badRequest = new NextRequest('http://localhost/api/opencode-settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: 'not valid json',
    });

    const response = await PUT(badRequest);
    expect(response.status).toBe(400);
  });

  // --- 500 failure cases (corrupt persistence root) ---

  it('GET returns 500 when persistence root is corrupted', async () => {
    const savedDir = process.env.DATA_DIR;
    process.env.DATA_DIR = '/nonexistent/path/that/should/fail';
    invalidateCache();

    try {
      const response = await GET();
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toMatch(/Failed to get opencode settings/i);
    } finally {
      if (savedDir === undefined) {
        delete process.env.DATA_DIR;
      } else {
        process.env.DATA_DIR = savedDir;
      }
      invalidateCache();
    }
  });

  it('PUT returns 500 when persistence root is corrupted', async () => {
    const savedDir = process.env.DATA_DIR;
    process.env.DATA_DIR = '/nonexistent/path/that/should/fail';
    invalidateCache();

    try {
      const badRequest = new NextRequest('http://localhost/api/opencode-settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          binaryPath: '/usr/bin/opencode',
          workingDirectory: '/home/user',
          timeoutMs: 60000,
          isConfigured: true,
        }),
      });

      const response = await PUT(badRequest);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toMatch(/Failed to update opencode settings/i);
    } finally {
      if (savedDir === undefined) {
        delete process.env.DATA_DIR;
      } else {
        process.env.DATA_DIR = savedDir;
      }
      invalidateCache();
    }
  });
});
