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
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertBetterSqlite3Loads } from '../helpers/abi-guard';

const TEST_PORT = 3010;
const READY_TIMEOUT_MS = 30_000;

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
    // best-effort
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

function findStandaloneServer(stageDir: string): string | null {
  const standaloneRoot = join(stageDir, 'frontend', '.next', 'standalone');
  if (!existsSync(standaloneRoot)) return null;
  const skipDirs = new Set(['node_modules', '.nvm']);
  const entries = readdirSync(standaloneRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || skipDirs.has(entry.name)) continue;
    const candidate = join(standaloneRoot, entry.name, 'server.js');
    if (existsSync(candidate)) return candidate;
  }
  // Fallback: <standalone>/frontend/server.js
  const alt = join(standaloneRoot, 'frontend', 'server.js');
  if (existsSync(alt)) return alt;
  return null;
}

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
