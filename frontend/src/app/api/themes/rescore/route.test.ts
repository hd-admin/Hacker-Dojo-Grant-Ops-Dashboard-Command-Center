import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { withTempDataDir, invalidateCache } from '../../../../../../shared/grant-ops-persistence';
import { resetDependencies } from '@/server/grant-ops/dependencies';
import { POST } from './route';

describe('POST /api/themes/rescore', () => {
  let tempDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDir = await withTempDataDir();
    invalidateCache();
    resetDependencies();
  });

  afterEach(async () => {
    resetDependencies();
    invalidateCache();
    await tempDir.cleanup();
  });

  it('returns success with rescored count when no grants', async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(typeof data.rescored).toBe('number');
    expect(data.rescored).toBe(0);
  });
});
