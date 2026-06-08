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
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertBetterSqlite3Loads } from '../helpers/abi-guard';
import {
  getInstallArgs,
  hasEnoughMemory,
  killProcessHoldingPort,
  pickInstaller,
  resolveRepoRoot,
  stageCleanWorkingTree,
  wipeRuntimeState,
} from './test-utils';

const TEST_PORT = 3001;

test.describe('Fresh user onboarding', () => {
  test('install + dev yields a responsive app on 127.0.0.1:3001', async ({}, testInfo) => {
    test.setTimeout(600_000);

    if (!hasEnoughMemory()) {
      test.skip(true, 'Skipped: insufficient memory for fresh install (<2GB detected)');
    }

    const repoRoot = resolveRepoRoot(testInfo.config.rootDir);
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
      const installArgs = getInstallArgs(installer);

      execSync(`${installer} ${installArgs.join(' ')}`, {
        cwd: stageDir,
        stdio: 'pipe',
        timeout: 480_000,
      });

      // The shipped `dev` script hardcodes `-p 3000`, so we cannot
      // satisfy `playwright.config.ts`'s webServer (port 3000) and the
      // test target (port 3001) with a single `pnpm run dev` call.
      // Invoking `next dev` directly with the test port keeps the
      // install path (`pnpm install` on a fresh tree) authentic
      // while still booting an isolated dev server. We strip NODE_ENV
      // for the same reason the shipped script does — a parent shell's
      // `NODE_ENV=production` would otherwise bypass dev-only loaders
      // (CSS) and produce a 500 on the first page render.
      const nextBin = join(stageDir, 'node_modules', '.bin', 'next');
      const devEnv = { ...process.env, HOSTNAME: '127.0.0.1' };
      delete devEnv.NODE_ENV;
      child = spawn(nextBin, ['dev', '-H', '127.0.0.1', '-p', String(TEST_PORT)], {
        cwd: join(stageDir, 'frontend'),
        env: devEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const collectedChunks: Buffer[] = [];
      const collectChunk = (chunk: Buffer) => {
        collectedChunks.push(chunk);
      };

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('dev server did not become ready within 90s')),
          90_000,
        );
        const onChunk = (chunk: Buffer) => {
          collectChunk(chunk);
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

      const collected = Buffer.concat(collectedChunks).toString('utf8');
      expect(
        collected,
        'dev server log must not contain the legacy ensure-better-sqlite3 predev shim',
      ).not.toContain('ensure-better-sqlite3');
      expect(
        collected,
        'dev server log must not reference a predev hook (see tests/no-predev-shim.test.ts)',
      ).not.toContain('predev');
      expect(
        collected,
        "dev server log must not surface the legacy `could not resolve a real Node binary` error",
      ).not.toContain('could not resolve a real Node binary');
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
