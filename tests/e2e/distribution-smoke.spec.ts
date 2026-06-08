/**
 * Production-distribution smoke test.
 *
 * Verifies that `pnpm build` (or `npm run build`) followed by
 * `node frontend/.next/standalone/<project-dir>/server.js` boots
 * with `PORT=3010 HOSTNAME=127.0.0.1` and serves GET / and
 * GET /api/health with the same assertions as the fresh-user spec.
 *
 * The build MUST NOT depend on any predev shim or pre-populated
 * `.grant-ops-data`. If the build fails for any reason, the test
 * fails (no skip).
 */
import { test, expect } from '@playwright/test';
import { execSync, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertBetterSqlite3Loads } from '../helpers/abi-guard';
import {
  findStandaloneServer,
  hasEnoughMemory,
  killProcessHoldingPort,
  pickInstaller,
  stageCleanWorkingTree,
  wipeRuntimeState,
} from './test-utils';

const TEST_PORT = 3010;
const READY_TIMEOUT_MS = 30_000;

test.describe('Production distribution smoke', () => {
  test('pnpm build + standalone server boots and serves / and /api/health', async ({}, testInfo) => {
    test.setTimeout(600_000);

    if (!hasEnoughMemory()) {
      test.skip(true, 'Skipped: insufficient memory for production build (<2GB detected)');
    }

    const repoRoot = testInfo.config.rootDir;
    const stageDir = mkdtempSync(join(tmpdir(), 'hdojo-dist-'));
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

      execSync(`${installer} run build`, {
        cwd: stageDir,
        stdio: 'pipe',
        timeout: 480_000,
      });

      const serverJs = findStandaloneServer(stageDir);
      expect(serverJs, 'standalone server.js must exist after build').not.toBeNull();
      if (!serverJs) {
        throw new Error('standalone server.js not found after build');
      }

      child = spawn(process.execPath, [serverJs], {
        cwd: stageDir,
        env: {
          ...process.env,
          PORT: String(TEST_PORT),
          HOSTNAME: '127.0.0.1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(`standalone server did not become ready within ${READY_TIMEOUT_MS}ms`),
            ),
          READY_TIMEOUT_MS,
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
          reject(new Error(`standalone server exited with code ${code} before becoming ready`)),
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
