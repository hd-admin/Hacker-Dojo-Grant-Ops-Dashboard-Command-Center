/**
 * Profile API Route Tests
 *
 * Tests the /api/profile GET route with real route handler invocation.
 * PUT handler removed — profile is hardcoded via HARDCODED_PROFILE and is read-only.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import { defaultProfile } from '../../../../../shared/seed-data';
import { GET } from './route';

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
});
