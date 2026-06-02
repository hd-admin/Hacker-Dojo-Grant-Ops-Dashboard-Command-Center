/**
 * Profile API Route Tests
 *
 * Tests the /api/profile GET route with real route handler invocation.
 * The profile is hardcoded — no persisted profile fallback.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import { HARDCODED_PROFILE } from '@/server/grant-ops/hardcoded-profile';
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

  it('GET returns hardcoded Hacker Dojo profile with _meta fields', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.legalName).toBe(HARDCODED_PROFILE.legalName);
    expect(data.ein).toBe(HARDCODED_PROFILE.ein);
    expect(data.mission).toBe(HARDCODED_PROFILE.mission);
    expect(data.agentBehavior).toBeDefined();
    expect(data.agentBehavior.notifyEmail).toBe(HARDCODED_PROFILE.agentBehavior.notifyEmail);
    expect(data._meta).toBeDefined();
    expect(typeof data._meta.submissionReady).toBe('boolean');
    expect(Array.isArray(data._meta.missingRequiredFields)).toBe(true);
    if (!data._meta.submissionReady) {
      expect(typeof data._meta.blockingReason).toBe('string');
      expect(data._meta.blockingReason.length).toBeGreaterThan(0);
    }
  });
});
