import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  backupBetterSqlite3Binding,
  findBetterSqlite3Binding,
  restoreBetterSqlite3Binding,
  setupFreshCloneWorkspace,
  withFakeNodeOnPath,
  withFakeCorepackShim,
} from './helpers/startup-test-utils';

test.describe('Startup verification', () => {
  test('pnpm setup:check exits 0', () => {
    const result = execSync('pnpm setup:check', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    expect(result).toContain('local setup verified');
  });

  test('better-sqlite3 loads and can execute a query', () => {
    const result = execSync(
      "node -e \"const db=require('better-sqlite3')(':memory:');console.log(db.prepare('select 1 as n').get().n);db.close();\"",
      { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
    );
    expect(result.trim().replace(/\u001b\[[0-9;]*m/g, '')).toBe('1');
  });

  test('.grant-ops-data/ directory is writable', () => {
    const dataDir = join(process.cwd(), '.grant-ops-data');
    expect(existsSync(dataDir)).toBe(true);
    // Verify write access by touching a test file
    const testFile = join(dataDir, '.write-test');
    try {
      const fs = require('fs');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
    } catch (_err) {
      throw new Error('.grant-ops-data/ is not writable');
    }
  });

  test('Node.js version is >= 20.0.0', () => {
    const version = process.versions.node;
    const [major] = version.split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(20);
  });

  test('fresh-clone workspace can bootstrap better-sqlite3', () => {
    test.setTimeout(300_000);
    const { workspacePath, cleanup } = setupFreshCloneWorkspace();
    try {
      expect(existsSync(workspacePath)).toBe(true);
      const binding = findBetterSqlite3Binding(workspacePath);
      expect(binding).toBeTruthy();
    } finally {
      cleanup();
      expect(existsSync(workspacePath)).toBe(false);
    }
  });

  test('missing-native-module triggers rebuild and exits 0', () => {
    test.setTimeout(240_000);
    const bindingPath = findBetterSqlite3Binding();
    if (!bindingPath) {
      test.skip(true, 'better_sqlite3.node binding not found in this environment');
      return;
    }
    const { originalPath, backupPath } = backupBetterSqlite3Binding();
    try {
      const result = execSync('bash scripts/ensure-better-sqlite3.sh 2>&1', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 200_000,
      });
      expect(result).toContain('better-sqlite3');
      // After restore, the binding should exist and be loadable
      expect(existsSync(originalPath)).toBe(true);
      const loadResult = execSync(
        "node -e \"const db=require('better-sqlite3')(':memory:');console.log(db.prepare('select 1 as n').get().n);db.close();\"",
        { encoding: 'utf-8', stdio: 'pipe', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
      );
      expect(loadResult.trim().replace(/\u001b\[[0-9;]*m/g, '')).toBe('1');
    } finally {
      restoreBetterSqlite3Binding(originalPath, backupPath);
    }
  });

  test('corrupted .grant-ops-data permissions causes setup-check to fail with permission error', () => {
    const dataDir = join(process.cwd(), '.grant-ops-data');
    const sentinel = join(dataDir, '.perm-test-sentinel');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(sentinel, 'ok');

    const originalMode = existsSync(dataDir)
      ? (existsSync(sentinel) ? 0o755 : 0o755)
      : 0o755;

    try {
      chmodSync(dataDir, 0o000);
      let combinedOutput = '';
      try {
        const out = execSync('bash scripts/setup-check.sh', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 60_000,
        });
        combinedOutput = out;
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        combinedOutput = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n');
      }
      expect(combinedOutput).toMatch(/fail|permission|not writable|cannot access/i);
    } finally {
      chmodSync(dataDir, originalMode);
      if (existsSync(sentinel)) {
        rmSync(sentinel);
      }
    }
  });

  test('fallback node resolution accepts snap/container wrappers', () => {
    const fakeDir = join(tmpdir(), `fake-node-fallback-${process.pid}`);
    mkdirSync(fakeDir, { recursive: true });
    const fakeNode = join(fakeDir, 'node');
    const script = `#!/bin/bash
if [ "\${1:-}" = "-v" ] || [ "\${1:-}" = "--version" ]; then
  echo "v20.0.0"
  exit 0
fi
if [ "\${1:-}" = "-e" ]; then
  printf 'other'
  exit 0
fi
exit 0
`;
    writeFileSync(fakeNode, script);
    chmodSync(fakeNode, 0o755);

    const originalPath = process.env.PATH ?? '';
    process.env.PATH = `${fakeDir}${originalPath ? ':' + originalPath : ''}`;

    try {
      const result = execSync('bash scripts/ensure-better-sqlite3.sh --diagnose 2>&1', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 30_000,
      });
      expect(result).toContain('resolved real Node');
    } finally {
      process.env.PATH = originalPath;
      if (existsSync(fakeDir)) {
        rmSync(fakeDir, { recursive: true, force: true });
      }
    }
  });

  test('insufficient Node version causes setup-check to fail with version error', () => {
    const fakeDir = join(tmpdir(), `fake-node-v16-${process.pid}`);
    const { restorePath } = withFakeNodeOnPath(fakeDir, 'v16.0.0');
    try {
      let combinedOutput = '';
      try {
        const out = execSync('bash scripts/setup-check.sh', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 60_000,
        });
        combinedOutput = out;
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        combinedOutput = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n');
      }
      expect(combinedOutput).toMatch(/version|required|Node\.js v20\+|20\.0\.0/i);
    } finally {
      restorePath();
    }
  });

  test('corepack shim fallback resolves to real Node via process.execPath', () => {
    const fakeDir = join(tmpdir(), `fake-corepack-shim-${process.pid}`);
    const { restorePath, fakeNodePath } = withFakeCorepackShim(fakeDir);
    const realNodePath = execSync('command -v node', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    try {
      const result = execSync('bash scripts/ensure-better-sqlite3.sh --diagnose 2>&1', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 30_000,
      });
      expect(result).toContain('resolved real Node');
      // Assert the resolved path is the real Node path, not the fake shim path
      expect(result).not.toContain(fakeNodePath);
      expect(result).toContain(realNodePath);
    } finally {
      restorePath();
    }
  });

  test('--skip-if-working exits 0 when better-sqlite3 is already functional', () => {
    const result = execSync('bash scripts/ensure-better-sqlite3.sh --skip-if-working 2>&1', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 30_000,
    });
    // Should exit 0 without attempting rebuild when module is already functional
    expect(result).toContain('better-sqlite3 already works');
  });
});
