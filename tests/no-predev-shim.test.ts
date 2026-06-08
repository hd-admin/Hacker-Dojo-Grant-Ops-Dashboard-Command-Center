import { describe, it, expect } from 'vitest';
import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');

const FORBIDDEN_HOOKS = [
  'predev',
  'prebuild',
  'prestart',
  'pretest',
  'prepare',
  'postinstall',
  'prepublishOnly',
] as const;

const PACKAGE_JSON_PATHS = [
  resolve(REPO_ROOT, 'package.json'),
  resolve(REPO_ROOT, 'frontend', 'package.json'),
] as const;

const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'playwright-report',
  'test-results',
  '.next',
  'dist',
  '.grant-ops-data',
]);

const PNPMRC_PATH = resolve(REPO_ROOT, '.pnpmrc');
const EXPECTED_PNPMRC_LINE = 'onlyBuiltDependencies=better-sqlite3 esbuild sharp unrs-resolver';

interface PackageJsonShape {
  scripts?: Record<string, string>;
}

function findForbiddenHooks(pkg: PackageJsonShape): string[] {
  const scripts = pkg.scripts ?? {};
  return FORBIDDEN_HOOKS.filter((hook) => Object.prototype.hasOwnProperty.call(scripts, hook));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listEnsureBetterSqlite3Paths(): Promise<string[]> {
  const matches: string[] = [];
  const stack: string[] = [REPO_ROOT];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) break;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        stack.push(full);
      } else if (entry.isFile()) {
        if (entry.name.toLowerCase().includes('ensure-better-sqlite3')) {
          matches.push(full);
        }
      }
    }
  }
  return matches;
}

describe('no predev / lifecycle shim invariants', () => {
  it.each(PACKAGE_JSON_PATHS)(
    '%s has no forbidden lifecycle hook (predev / prebuild / prestart / pretest / prepare / postinstall / prepublishOnly) — these hooks previously surfaced as `could not resolve a real Node binary` to fresh operators',
    async (pkgPath) => {
      const raw = await readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(raw) as PackageJsonShape;
      const offenders = findForbiddenHooks(pkg);
      expect(
        offenders,
        `${pkgPath} must not define any of: ${FORBIDDEN_HOOKS.join(', ')} (found: ${offenders.join(', ') || 'none'})`,
      ).toEqual([]);
    },
  );

  it('no ensure-better-sqlite3* file exists anywhere in the repo (skipping node_modules, .git, playwright-report, test-results, .next, dist, .grant-ops-data)', async () => {
    const matches = await listEnsureBetterSqlite3Paths();
    const offenders = matches.filter(
      (m) => !SKIP_DIRECTORIES.has(m.split(sep).slice(-2, -1)[0] ?? ''),
    );
    expect(
      offenders,
      `Found forbidden ensure-better-sqlite3 artifacts: ${offenders.join(', ') || 'none'}`,
    ).toEqual([]);
  });

  it('scripts/check-better-sqlite3.sh is the verify-only successor (not a predev shim)', async () => {
    const verifyOnlyPath = resolve(REPO_ROOT, 'scripts', 'check-better-sqlite3.sh');
    expect(await fileExists(verifyOnlyPath)).toBe(true);
    const content = await readFile(verifyOnlyPath, 'utf8');
    expect(content).toContain("require('better-sqlite3')");
    expect(content).not.toMatch(/^predev=/m);
  });

  it('.pnpmrc contains the canonical onlyBuiltDependencies line so pnpm rebuilds better-sqlite3 against the current Node ABI on `pnpm install`', async () => {
    expect(await fileExists(PNPMRC_PATH)).toBe(true);
    const content = await readFile(PNPMRC_PATH, 'utf8');
    const lines = content.split('\n').map((line) => line.trim());
    expect(lines).toContain(EXPECTED_PNPMRC_LINE);
  });
});
