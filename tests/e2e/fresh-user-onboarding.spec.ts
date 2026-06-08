/**
 * Fresh-user onboarding smoke test.
 *
 * Simulates a brand-new operator with:
 *   - no predev shim
 *   - no pre-built `.next`
 *   - no `.grant-ops-data` carry-over
 *   - no `node_modules`
 *
 * Stages a clean working tree in a tmpdir via
 *   git archive --format=tar HEAD | tar -x
 * (the canonical fresh-clone simulation; this preserves dotfiles like
 * `.agent-startup.log`, `.gitignore`, `.pnpmrc` in a single pass; the
 * prior `git ls-files | xargs rsync` approach missed dotfiles and was
 * fragile on paths with spaces).
 *
 * Wipes runtime state via the explicit allowlist in
 * `wipeRuntimeState()` (`.next`, `.grant-ops-data`,
 * `playwright-report`, `test-results`, `.agent/tmp`).
 *
 * `killProcessHoldingPort()` is the safety net for re-runs on the
 * same CI machine: it sends SIGTERM to any lsof match for TEST_PORT,
 * waits 3s, and escalates to SIGKILL.
 *
 * The test is skippable on memory-constrained runners (<2GB detected)
 * to match the AGENTS.md §7 spirit.
 */
import { test, expect } from '@playwright/test';
import { execSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertBetterSqlite3Loads } from '../helpers/abi-guard';

const TEST_PORT = 3001;

function stageCleanWorkingTree(repoRoot: string, stageDir: string): void {
  execSync(`git -C "${repoRoot}" archive --format=tar HEAD | tar -x -C "${stageDir}"`, {
    stdio: 'pipe',
  });
}

function wipeRuntimeState(stageDir: string): void {
  const paths = [
    join(stageDir, 'node_modules'),
    join(stageDir, 'frontend', '.next'),
    join(stageDir, '.next'),
    join(stageDir, '.grant-ops-data'),
    join(stageDir, 'playwright-report'),
    join(stageDir, 'test-results'),
    join(stageDir, '.agent', 'tmp'),
  ];
  for (const p of paths) {
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
}

function killProcessHoldingPort(port: number): void {
  try {
    const pid = execSync(`lsof -ti tcp:${port} 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
    if (pid) {
      spawnSync('kill', ['-TERM', ...pid.split(/\s+/).filter(Boolean)], { stdio: 'ignore' });
      const start = Date.now();
      while (Date.now() - start < 3000) {
        const stillThere = execSync(`lsof -ti tcp:${port} 2>/dev/null || true`, {
          encoding: 'utf-8',
        }).trim();
        if (!stillThere) return;
        execSync('sleep 0.2');
      }
      spawnSync('kill', ['-KILL', ...pid.split(/\s+/).filter(Boolean)], { stdio: 'ignore' });
    }
  } catch {
    // lsof not available or no match — nothing to do.
  }
}

function pickInstaller(stageDir: string): 'pnpm' | 'npm' {
  if (existsSync(join(stageDir, 'pnpm-lock.yaml'))) {
    const probe = spawnSync('pnpm', ['--version'], { stdio: 'pipe' });
    if (probe.status === 0) return 'pnpm';
  }
  return 'npm';
}

function hasEnoughMemory(): boolean {
  try {
    const entries = readdirSync('/');
    if (!entries.includes('proc')) return true;
    const meminfo = readFileSync('/proc/meminfo', 'utf8');
    const match = meminfo.match(/MemTotal:\s+(\d+)\s+kB/);
    if (!match) return true;
    const totalMb = Math.round(parseInt(match[1], 10) / 1024);
    return totalMb >= 2048;
  } catch {
    return true;
  }
}

test.describe('Fresh user onboarding', () => {
  test('install + dev yields a responsive app on 127.0.0.1:3001', async ({}, testInfo) => {
    test.setTimeout(600_000);

    if (!hasEnoughMemory()) {
      test.skip(true, 'Skipped: insufficient memory for fresh install (<2GB detected)');
    }

    const repoRoot = testInfo.config.rootDir;
    const stageDir = mkdtempSync(join(tmpdir(), 'hdojo-fresh-'));
    let child: ReturnType<typeof spawn> | null = null;
    try {
      stageCleanWorkingTree(repoRoot, stageDir);
      wipeRuntimeState(stageDir);
      killProcessHoldingPort(TEST_PORT);

      const abi = await assertBetterSqlite3Loads();
      if (!abi.ok) {
        throw new Error(`better-sqlite3 cannot be loaded: ${abi.message}`);
      }

      const installer = pickInstaller(stageDir);

      execSync(`${installer} install --no-audit --no-fund`, {
        cwd: stageDir,
        stdio: 'pipe',
        timeout: 480_000,
      });

      child = spawn(`${installer}`, ['run', 'dev'], {
        cwd: stageDir,
        env: { ...process.env, PORT: String(TEST_PORT), HOSTNAME: '127.0.0.1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('dev server did not become ready within 90s')),
          90_000,
        );
        const onChunk = (chunk: Buffer) => {
          if (chunk.toString('utf8').toLowerCase().includes('ready')) {
            clearTimeout(timer);
            child?.stdout?.off('data', onChunk);
            child?.stderr?.off('data', onChunk);
            resolve();
          }
        };
        child?.stdout?.on('data', onChunk);
        child?.stderr?.on('data', onChunk);
        child?.once('exit', (code) =>
          reject(new Error(`dev server exited with code ${code} before becoming ready`)),
        );
      });

      const home = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
      expect(home.status).toBe(200);
      const homeBody = await home.text();
      expect(homeBody).toContain('Hacker Dojo');

      const health = await fetch(`http://127.0.0.1:${TEST_PORT}/api/health`);
      expect(health.status).toBe(200);
      const healthBody = (await health.json()) as { storage?: string };
      expect(healthBody.storage).toBe('ok');
    } finally {
      try {
        if (child && child.pid) {
          spawnSync('kill', ['-TERM', String(child.pid)], { stdio: 'ignore' });
        }
      } catch {
        // best-effort
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 5000));
      try {
        execSync(`lsof -ti tcp:${TEST_PORT} 2>/dev/null | xargs -r kill -KILL`, {
          stdio: 'ignore',
        });
      } catch {
        // best-effort
      }
      rmSync(stageDir, { recursive: true, force: true });
    }
  });
});
