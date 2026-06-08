import type { APIRequestContext, Page } from '@playwright/test';
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

export const BASE_URL = 'http://127.0.0.1:3000';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stage a clean working tree by streaming `git archive` into a tmpdir.
 * This is the canonical fresh-clone simulation; it preserves dotfiles
 * (e.g. `.agent-startup.log`, `.gitignore`, `.pnpmrc`) in a single
 * pass. The prior `git ls-files | xargs rsync` approach missed dotfiles
 * and was fragile on paths with spaces.
 */
export function stageCleanWorkingTree(repoRoot: string, stageDir: string): void {
  execSync(`git -C "${repoRoot}" archive --format=tar HEAD | tar -x -C "${stageDir}"`, {
    stdio: 'pipe',
  });
}

/**
 * Wipe the explicit allowlist of paths that carry runtime state.
 * The list is intentionally narrow so we never delete user data
 * outside the test boundary.
 */
export function wipeRuntimeState(stageDir: string): void {
  const paths = [
    path.join(stageDir, 'node_modules'),
    path.join(stageDir, 'frontend', '.next'),
    path.join(stageDir, '.next'),
    path.join(stageDir, '.grant-ops-data'),
    path.join(stageDir, 'playwright-report'),
    path.join(stageDir, 'test-results'),
    path.join(stageDir, '.agent', 'tmp'),
  ];
  for (const p of paths) {
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
}

/**
 * Best-effort kill of any process holding `port`. Sends SIGTERM,
 * waits up to 3s, then escalates to SIGKILL.
 */
export function killProcessHoldingPort(port: number): void {
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

/**
 * Pick the package manager for the staged tree. Prefers pnpm when a
 * pnpm-lock.yaml is present and pnpm is on PATH, falls back to npm.
 */
export function pickInstaller(stageDir: string): 'pnpm' | 'npm' {
  if (existsSync(path.join(stageDir, 'pnpm-lock.yaml'))) {
    const probe = spawnSync('pnpm', ['--version'], { stdio: 'pipe' });
    if (probe.status === 0) return 'pnpm';
  }
  return 'npm';
}

/**
 * Detect a low-memory runner so the heavy e2e specs (fresh install,
 * standalone build) can skip with an explicit reason.
 */
export function hasEnoughMemory(): boolean {
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

/**
 * Locate the standalone server produced by `next build`. The build
 * script copies `.next/static` into the standalone tree at
 * `<standalone>/<project-dir>/server.js`; we also handle the
 * `<standalone>/frontend/server.js` layout that some Next.js versions
 * produce when the source root is `frontend/`.
 */
export function findStandaloneServer(stageDir: string): string | null {
  const standaloneRoot = path.join(stageDir, 'frontend', '.next', 'standalone');
  if (!existsSync(standaloneRoot)) return null;
  const skipDirs = new Set(['node_modules', '.nvm']);
  const entries = readdirSync(standaloneRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || skipDirs.has(entry.name)) continue;
    const candidate = path.join(standaloneRoot, entry.name, 'server.js');
    if (existsSync(candidate)) return candidate;
  }
  const alt = path.join(standaloneRoot, 'frontend', 'server.js');
  if (existsSync(alt)) return alt;
  return null;
}

export async function resetAppState(request: APIRequestContext): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const response = await request.post(`${BASE_URL}/api/testing/reset`);
      if (response.ok()) {
        return;
      }
      throw new Error(`Failed to reset app state: ${response.status()}`);
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to reset app state');
}

export async function openSettingsView(page: Page): Promise<void> {
  await page.click('[data-view="settings"]');
  await page.waitForSelector('#view-settings.active', { timeout: 10000 });
}

// DEPRECATED: Profile is now hardcoded (v2). PUT /api/profile removed.
// Use this only as a no-op stub for backward compat with existing tests.
export async function saveProfileThroughSettingsView(_page: Page, _mission: string): Promise<void> {
  // Profile is hardcoded — no-op
}

// Configures opencode settings via testing API for E2E tests.
// The /api/opencode-settings UI endpoint was removed in v2, so we use
// a testing-only endpoint to set the required configuration.
export async function configureOpencodeThroughSettingsView(
  page: Page,
  binaryPath: string,
  workingDirectory: string,
): Promise<void> {
  // Resolve relative paths to absolute so the server (which runs from
  // frontend/) can locate the stub binary correctly.
  const resolvedBinaryPath = path.isAbsolute(binaryPath)
    ? binaryPath
    : path.resolve(workingDirectory, binaryPath);
  const response = await page.request.fetch(`${BASE_URL}/api/testing/configure-opencode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { binaryPath: resolvedBinaryPath, workingDirectory },
  });
  if (!response.ok()) {
    throw new Error(`Failed to configure opencode: ${response.status()}`);
  }
}

export async function markScheduleDue(request: APIRequestContext, sourceId: string): Promise<void> {
  const response = await request.post(
    `${BASE_URL}/api/sources/${encodeURIComponent(sourceId)}/schedule/mark-due`,
  );
  if (!response.ok()) {
    throw new Error(`Failed to mark schedule due for source ${sourceId}: ${response.status()}`);
  }
}

export async function uploadDocumentThroughSettingsView(
  page: Page,
  filePath: string,
): Promise<void> {
  await openSettingsView(page);
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/documents') && response.request().method() === 'POST',
  );
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('button.upload-item').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
  await uploadResponse;
  await page.waitForFunction(
    (fileName) => {
      return Array.from(document.querySelectorAll('.doc-item')).some((node) =>
        node.textContent?.includes(fileName),
      );
    },
    filePath.split(/[\\/]/).pop() ?? '',
  );
}
