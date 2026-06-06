import { describe, expect, it } from 'vitest';
import { defaultOpencodeSettings, defaultProfile } from './seed-data';

describe('seed-data', () => {
  it('exports defaultProfile with required fields', () => {
    expect(defaultProfile).toBeDefined();
    expect(typeof defaultProfile.legalName).toBe('string');
    expect(typeof defaultProfile.ein).toBe('string');
    expect(Array.isArray(defaultProfile.programAreas)).toBe(true);
  });

  it('exports defaultOpencodeSettings with correct defaults', () => {
    expect(defaultOpencodeSettings).toBeDefined();
    expect(defaultOpencodeSettings.binaryPath).toBe('');
    expect(defaultOpencodeSettings.workingDirectory).toBe('');
    expect(defaultOpencodeSettings.timeoutMs).toBe(60000);
    expect(defaultOpencodeSettings.isConfigured).toBe(false);
  });
});
