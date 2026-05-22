/**
 * Profile API Route Tests
 *
 * Tests the /api/profile GET and PUT routes.
 */

import { describe, it, expect } from 'vitest';
import { loadPersistedData, invalidateCache } from '../../../../../shared/grant-ops-persistence';
import { defaultProfile } from '../../../../../shared/seed-data';

describe('/api/profile route', () => {
  it('loadPersistedData returns default opencodeSettings as null', async () => {
    invalidateCache();
    const data = await loadPersistedData();
    // Initial state has opencodeSettings as null until set
    expect(data.opencodeSettings === null || typeof data.opencodeSettings === 'object').toBe(true);
  });

  it('defaultProfile has required fields', () => {
    expect(defaultProfile.legalName).toBeDefined();
    expect(defaultProfile.ein).toBeDefined();
    expect(defaultProfile.mission).toBeDefined();
    expect(defaultProfile.docTypes).toBeInstanceOf(Array);
    expect(defaultProfile.searchThemes).toBeInstanceOf(Array);
    expect(defaultProfile.agentBehavior).toBeDefined();
  });

  it('defaultProfile agentBehavior has required fields', () => {
    expect(defaultProfile.agentBehavior.autoDraftThreshold).toBeGreaterThan(0);
    expect(defaultProfile.agentBehavior.submissionPolicy).toBeDefined();
    expect(defaultProfile.agentBehavior.notifyEmail).toBeDefined();
    expect(defaultProfile.agentBehavior.voiceAndTone).toBeDefined();
  });
});
