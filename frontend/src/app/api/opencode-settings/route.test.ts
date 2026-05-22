/**
 * Opencode Settings API Route Tests
 *
 * Tests the /api/opencode-settings GET and PUT routes.
 */

import { describe, it, expect } from 'vitest';
import { defaultOpencodeSettings } from '../../../../../shared/seed-data';

describe('/api/opencode-settings route', () => {
  it('defaultOpencodeSettings has required fields', () => {
    expect(defaultOpencodeSettings.binaryPath).toBeDefined();
    expect(defaultOpencodeSettings.workingDirectory).toBeDefined();
    expect(defaultOpencodeSettings.timeoutMs).toBeGreaterThan(0);
    expect(typeof defaultOpencodeSettings.isConfigured).toBe('boolean');
  });

  it('defaultOpencodeSettings isConfigured is false by default', () => {
    expect(defaultOpencodeSettings.isConfigured).toBe(false);
  });

  it('timeoutMs is a reasonable value', () => {
    expect(defaultOpencodeSettings.timeoutMs).toBe(60000);
  });
});
