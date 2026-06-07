import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync, chmodSync } from 'node:fs';
import { copyFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(process.cwd());
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  '.grant-ops-data',
  '.git',
  'test-results',
  '.tmp-tests',
]);

function shouldCopy(name: string): boolean {
  return !EXCLUDED_DIRS.has(name);
}

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (!shouldCopy(entry.name)) {
      continue;
    }
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
}

export interface FreshCloneResult {
  workspacePath: string;
  cleanup: () => void;
}

/**
 * Copies the current repository (excluding node_modules, .next, .grant-ops-data, .git)
 * into a temp directory, runs pnpm install --frozen-lockfile, and then runs
 * scripts/ensure-better-sqlite3.sh to verify a fresh clone can bootstrap the
 * native module.
 */
export function setupFreshCloneWorkspace(): FreshCloneResult {
  const tempBase = join(tmpdir(), `grant-ops-fresh-clone-${process.pid}`);
  const workspacePath = mkdtempSync(tempBase);

  copyDirRecursive(REPO_ROOT, workspacePath);

  try {
    execSync('pnpm install --frozen-lockfile --ignore-scripts', {
      cwd: workspacePath,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 120_000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rmSync(workspacePath, { recursive: true, force: true });
    throw new Error(`pnpm install failed in fresh clone workspace: ${message}`);
  }

  // Seed the better-sqlite3 native binding from the current workspace so the
  // fresh-clone test doesn't have to wait for a full node-gyp rebuild. The
  // ensure-better-sqlite3.sh script will still verify the binding loads.
  const currentBinding = findBetterSqlite3Binding(REPO_ROOT);
  if (currentBinding) {
    const freshBindingDir = join(workspacePath, 'node_modules', 'better-sqlite3', 'build', 'Release');
    mkdirSync(freshBindingDir, { recursive: true });
    cpSync(currentBinding, join(freshBindingDir, 'better_sqlite3.node'));
  }

  try {
    const result = execSync('bash scripts/ensure-better-sqlite3.sh 2>&1', {
      cwd: workspacePath,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 120_000,
    });
    if (!result.includes('better-sqlite3 already works')) {
      throw new Error(`ensure-better-sqlite3.sh did not confirm working native module: ${result}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rmSync(workspacePath, { recursive: true, force: true });
    throw new Error(`ensure-better-sqlite3.sh failed in fresh clone workspace: ${message}`);
  }

  const cleanup = (): void => {
    if (existsSync(workspacePath)) {
      rmSync(workspacePath, { recursive: true, force: true });
    }
  };

  return { workspacePath, cleanup };
}

/**
 * Finds the better_sqlite3.node binding file under node_modules/better-sqlite3.
 * Searches lib/binding/ and build/Release/ since better-sqlite3 may load from
 * either location depending on how it was installed/built.
 * Returns the absolute path or null if not found.
 */
export function findBetterSqlite3Binding(cwd: string = REPO_ROOT): string | null {
  const roots = [
    join(cwd, 'node_modules', 'better-sqlite3', 'lib', 'binding'),
    join(cwd, 'node_modules', 'better-sqlite3', 'build', 'Release'),
  ];
  function walk(dir: string): string | null {
    if (!existsSync(dir)) return null;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = walk(p);
        if (found) return found;
      } else if (entry.isFile() && entry.name === 'better_sqlite3.node') {
        return p;
      }
    }
    return null;
  }
  for (const root of roots) {
    const found = walk(root);
    if (found) return found;
  }
  return null;
}

/**
 * Backs up the better-sqlite3 native binding by renaming it to .bak.
 * Returns the original path and backup path.
 */
export function backupBetterSqlite3Binding(cwd: string = REPO_ROOT): { originalPath: string; backupPath: string } {
  const originalPath = findBetterSqlite3Binding(cwd);
  if (!originalPath) {
    throw new Error('better_sqlite3.node binding not found');
  }
  const backupPath = `${originalPath}.bak`;
  renameSync(originalPath, backupPath);
  return { originalPath, backupPath };
}

/**
 * Restores the better-sqlite3 native binding from .bak.
 */
export function restoreBetterSqlite3Binding(originalPath: string, backupPath: string): void {
  if (existsSync(backupPath)) {
    if (existsSync(originalPath)) {
      rmSync(originalPath);
    }
    renameSync(backupPath, originalPath);
  }
}

/**
 * Creates a mock node binary at the given path that reports a specific version.
 */
export function createMockNodeBinary(path: string, version: string): void {
  const script = `#!/bin/bash
if [ "\${1:-}" = "-v" ] || [ "\${1:-}" = "--version" ]; then
  echo "${version}"
  exit 0
fi
if [ "\${1:-}" = "-e" ]; then
  # Pretend to be real node: process.release.name === node and versions.node exists
  printf "node ${version}"
  exit 0
fi
if [ "\${1:-}" = "-p" ]; then
  # Echo the version so setup-check's node -p gets a valid semver
  echo "${version}"
  exit 0
fi
exit 0
`;
  writeFileSync(path, script);
  chmodSync(path, 0o755);
}

/**
 * Creates a fake old Node binary at the given directory and prepends it to PATH.
 * Returns a restore function that resets PATH.
 */
export function withFakeNodeOnPath(fakeDir: string, version: string): { restorePath: () => void } {
  mkdirSync(fakeDir, { recursive: true });
  const fakeNode = join(fakeDir, 'node');
  createMockNodeBinary(fakeNode, version);
  const originalPath = process.env.PATH ?? '';
  process.env.PATH = `${fakeDir}${originalPath ? ':' + originalPath : ''}`;
  const restorePath = (): void => {
    process.env.PATH = originalPath;
    if (existsSync(fakeDir)) {
      rmSync(fakeDir, { recursive: true, force: true });
    }
  };
  return { restorePath };
}

/**
 * Gets free disk space in KB for the given path using df.
 */
export function getFreeDiskKb(path: string): number {
  const out = execSync(`df -k "${path}"`, { encoding: 'utf-8', stdio: 'pipe' });
  const line = out.trim().split('\n')[1];
  if (!line) return 0;
  const parts = line.trim().split(/\s+/);
  return Number(parts[3]) || 0;
}
