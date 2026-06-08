import { test, expect } from '@playwright/test';
import { execFileSync, execSync } from 'child_process';
import { existsSync } from 'fs';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

  test('node -e "require(\'better-sqlite3\'); console.log(\'node-abi: ok\')" exits 0 and prints the canonical ok string', () => {
    const result = execFileSync(
      process.execPath,
      ['-e', "require('better-sqlite3'); console.log('node-abi: ok');"],
      {
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, NODE_NO_WARNINGS: '1', NO_COLOR: '1' },
      },
    );
    const cleaned = result.replace(/\u001b\[[0-9;]*m/g, '').trim();
    expect(cleaned).toContain('node-abi: ok');
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

  test('insufficient Node version causes setup-check to fail with version error', () => {
    const fakeDir = join(process.cwd(), `.fake-node-v16-${process.pid}`);
    mkdirSync(fakeDir, { recursive: true });
    const fakeNode = join(fakeDir, 'node');
    const script = `#!/bin/bash
if [ "\${1:-}" = "-v" ] || [ "\${1:-}" = "--version" ]; then
  echo "v16.0.0"
  exit 0
fi
exit 0
`;
    writeFileSync(fakeNode, script);
    chmodSync(fakeNode, 0o755);

    const originalPath = process.env.PATH ?? '';
    process.env.PATH = `${fakeDir}${originalPath ? ':' + originalPath : ''}`;

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
      process.env.PATH = originalPath;
      if (existsSync(fakeDir)) {
        rmSync(fakeDir, { recursive: true, force: true });
      }
    }
  });
});
