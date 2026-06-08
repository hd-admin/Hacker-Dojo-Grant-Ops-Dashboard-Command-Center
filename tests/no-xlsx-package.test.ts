import { describe, it, expect } from 'vitest';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');

const PACKAGE_FILES = [
  resolve(REPO_ROOT, 'package.json'),
  resolve(REPO_ROOT, 'frontend/package.json'),
];

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function collectDependencyNames(pkg: PackageJsonShape): string[] {
  const buckets = [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ];
  const names: string[] = [];
  for (const bucket of buckets) {
    if (!bucket) continue;
    for (const name of Object.keys(bucket)) {
      names.push(name);
    }
  }
  return names;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('no xlsx package may be added', () => {
  it.each(PACKAGE_FILES)('does not depend on xlsx in %s', async (pkgPath) => {
    const raw = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as PackageJsonShape;
    const names = collectDependencyNames(pkg);
    const offenders = names.filter((name) => name.toLowerCase() === 'xlsx');
    expect(offenders, `package.json at ${pkgPath} must not depend on xlsx`).toEqual([]);
  });

  it('lockfiles at repo root do not pin xlsx', async () => {
    const entries = await readdir(REPO_ROOT);
    const lockfiles = entries.filter(
      (name) => name.endsWith('.lock') || name === 'package-lock.json' || name === 'pnpm-lock.yaml',
    );
    for (const lock of lockfiles) {
      const fullPath = resolve(REPO_ROOT, lock);
      const raw = await readFile(fullPath, 'utf8');
      // The lockfile may legitimately mention xlsx in a comment; require the
      // strict entry shape (key + version pin) to avoid false positives.
      const hasXlsxEntry = /["']xlsx["']\s*:\s*\{/.test(raw);
      expect(hasXlsxEntry, `lockfile ${lock} must not pin xlsx as a top-level entry`).toBe(false);
    }
  });
});

describe('no xlsx import statements in app code', () => {
  const ALLOWLIST = new Set<string>([
    // Test scaffolding for this guard may legitimately reference xlsx.
    resolve(REPO_ROOT, 'tests/no-xlsx-package.test.ts'),
    // Historical log files at the repo root are explicitly out of scope
    // for runtime code; they live outside the source tree.
    resolve(REPO_ROOT, '.agent-startup.log'),
    resolve(REPO_ROOT, '.agent-runtime.log'),
  ]);

  async function walk(dir: string, acc: string[] = []): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          ['node_modules', '.next', '.git', 'test-results', 'playwright-report', 'dist'].includes(
            entry.name,
          )
        ) {
          continue;
        }
        await walk(full, acc);
      } else if (entry.isFile()) {
        if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(entry.name)) {
          acc.push(full);
        }
      }
    }
    return acc;
  }

  it('runtime source has no `import ... from "xlsx"` or `require("xlsx")`', async () => {
    const sourceRoots = [resolve(REPO_ROOT, 'frontend/src'), resolve(REPO_ROOT, 'shared')];
    const offenders: { file: string; line: string }[] = [];

    const importRe = /from\s+['"]xlsx['"]/;
    const requireRe = /require\(\s*['"]xlsx['"]\s*\)/;

    for (const root of sourceRoots) {
      if (!(await fileExists(root))) continue;
      const files = await walk(root);
      for (const file of files) {
        if (ALLOWLIST.has(file)) continue;
        const content = await readFile(file, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          if (importRe.test(line) || requireRe.test(line)) {
            offenders.push({ file, line: line.trim() });
          }
        }
      }
    }

    expect(offenders, `forbidden xlsx imports:\n${JSON.stringify(offenders, null, 2)}`).toEqual([]);
  });
});
