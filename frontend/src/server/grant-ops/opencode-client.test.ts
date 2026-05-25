/**
 * Opencode Client Tests
 *
 * Tests the Opencode adapter contract:
 * - CLI provider requires configured settings
 * - Unconfigured settings fail explicitly
 * - Fake provider works without configuration
 * - Research and draft generation work correctly
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { OpencodeSettings } from '../../../../shared/types';
import { createOpencodeAdapter, normalizeOpencodeOutput } from './opencode-client';

const defaultSettings: OpencodeSettings = {
  binaryPath: '/usr/local/bin/opencode',
  workingDirectory: '/Users/test/opencode',
  timeoutMs: 60000,
  profile: 'grant-research',
  isConfigured: false,
};

describe('OpencodeClient', () => {
  describe('CLI provider', () => {
    it('isConfigured returns false when binaryPath is empty', () => {
      const settings: OpencodeSettings = {
        ...defaultSettings,
        binaryPath: '',
        isConfigured: false,
      };
      const adapter = createOpencodeAdapter(settings, 'cli');
      expect(adapter.isConfigured()).toBe(false);
    });

    it('isConfigured returns true when binaryPath is set and isConfigured is true', () => {
      const settings: OpencodeSettings = {
        ...defaultSettings,
        binaryPath: '/usr/local/bin/opencode',
        isConfigured: true,
      };
      const adapter = createOpencodeAdapter(settings, 'cli');
      expect(adapter.isConfigured()).toBe(true);
    });

    it('executeResearch fails explicitly when not configured', async () => {
      const settings: OpencodeSettings = {
        ...defaultSettings,
        binaryPath: '',
        isConfigured: false,
      };
      const adapter = createOpencodeAdapter(settings, 'cli');
      const result = await adapter.executeResearch({
        organizationProfile: 'Test Org',
        searchThemes: ['EdTech'],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('executeResearch uses the wrapper-compatible run prompt --output-format json contract', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-client-contract-'));
      const fakeOpencode = path.join(tempDir, 'opencode-fake.sh');
      const argsFile = path.join(tempDir, 'args.txt');
      const expectedJson = JSON.stringify({ grants: [], evidence: [], rationale: 'ok' });

      fs.writeFileSync(
        fakeOpencode,
        `#!/bin/sh
set -eu
printf '%s\n' "$*" > "$ARGS_FILE"
cat <<'EOF'
${expectedJson}
EOF
`,
        'utf8',
      );
      fs.chmodSync(fakeOpencode, 0o755);

      const previousArgsFile = process.env.ARGS_FILE;
      process.env.ARGS_FILE = argsFile;

      try {
        const settings: OpencodeSettings = {
          ...defaultSettings,
          binaryPath: fakeOpencode,
          workingDirectory: tempDir,
          isConfigured: true,
        };
        const adapter = createOpencodeAdapter(settings, 'cli');
        const result = await adapter.executeResearch({
          organizationProfile: 'Test Org',
          searchThemes: ['EdTech', 'Community'],
        });

        expect(result.success).toBe(true);
        expect(result.content).toBe(expectedJson);
        const args = fs.readFileSync(argsFile, 'utf8').trim();
        expect(args).toContain('run');
        expect(args).toContain('--output-format json');
        expect(args).not.toContain('--format json');
        expect(args).not.toContain('--dangerously-skip-permissions');
      } finally {
        process.env.ARGS_FILE = previousArgsFile;
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('generateDraft fails explicitly when not configured', async () => {
      const settings: OpencodeSettings = {
        ...defaultSettings,
        binaryPath: '',
        isConfigured: false,
      };
      const adapter = createOpencodeAdapter(settings, 'cli');
      const result = await adapter.generateDraft({
        grantTitle: 'Test Grant',
        grantFunder: 'Test Funder',
        organizationProfile: 'Test Org',
        missionStatement: 'Test mission',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('Fake provider', () => {
    it('isConfigured returns true for fake provider', () => {
      const adapter = createOpencodeAdapter(defaultSettings, 'fake');
      expect(adapter.isConfigured()).toBe(true);
    });

    it('executeResearch returns mock data', async () => {
      const adapter = createOpencodeAdapter(defaultSettings, 'fake');
      const result = await adapter.executeResearch({
        organizationProfile: 'Test Org',
        searchThemes: ['EdTech', 'Community'],
      });
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content!);
      expect(data.grants).toBeDefined();
      expect(Array.isArray(data.grants)).toBe(true);
    });

    it('generateDraft returns mock draft content', async () => {
      const adapter = createOpencodeAdapter(defaultSettings, 'fake');
      const result = await adapter.generateDraft({
        grantTitle: 'Test Grant',
        grantFunder: 'Test Funder',
        organizationProfile: 'Test Org',
        missionStatement: 'Test mission',
      });
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content).toContain('Test Grant');
    });
  });

  describe('Output normalization', () => {
    it('extracts text payloads from Opencode JSON event streams', () => {
      const output = [
        '{"type":"step_start","part":{"type":"step-start"}}',
        '{"type":"text","part":{"text":"first line"}}',
        '{"type":"text","part":{"text":"second line"}}',
        '{"type":"step_finish","part":{"type":"step-finish"}}',
      ].join('\n');

      expect(normalizeOpencodeOutput(output)).toBe('first line\nsecond line');
      expect(normalizeOpencodeOutput(' plain text ')).toBe('plain text');
    });
  });

  describe('Provider selection', () => {
    it('uses fake provider when specified', () => {
      const adapter = createOpencodeAdapter(defaultSettings, 'fake');
      expect(adapter.isConfigured()).toBe(true);
    });

    it('uses cli provider when specified', () => {
      const settings: OpencodeSettings = {
        ...defaultSettings,
        isConfigured: true,
      };
      const adapter = createOpencodeAdapter(settings, 'cli');
      expect(adapter.isConfigured()).toBe(true);
    });
  });
});
