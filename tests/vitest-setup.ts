// ── Per-test-suite SQLite DB isolation ──────────────────────────────────
// Set a unique DATA_DIR before any test module loads resolveDataDir().
// Uses raw strings (no Node builtins) because jsdom tests stub all
// node:* imports. fileParallelism:false ensures sequential execution.
// Test files that call withTempDataDir() will override this temporarily
// and restore it afterwards.
if (typeof process !== 'undefined' && process.env && !process.env.DATA_DIR) {
  const tmpRoot = process.env.TMPDIR ?? '/tmp/vitest';
  process.env.DATA_DIR = `${tmpRoot}/vitest-db-${Date.now()}`;
}

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

try {
  const require = createRequire(import.meta.url);
  const repoRoot = path.resolve(process.cwd());
  const ensureScript = path.join(repoRoot, 'scripts', 'ensure-better-sqlite3.sh');

  function canLoadBetterSqlite3(): boolean {
    try {
      const Database = require('better-sqlite3') as typeof import('better-sqlite3');
      const db = new Database(':memory:');
      db.prepare('select 1').get();
      db.close();
      return true;
    } catch {
      return false;
    }
  }

  if (!canLoadBetterSqlite3()) {
    execFileSync('bash', [ensureScript], {
      cwd: repoRoot,
      stdio: 'inherit',
    });

    if (!canLoadBetterSqlite3()) {
      throw new Error('better-sqlite3 is still unavailable after rebuild');
    }
  }
} catch {
  // jsdom environment - Node.js builtins are externalized stubs
  // Component tests don't need native modules
}

// Mock next/server connection() for route handler tests
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...(actual as object),
    connection: vi.fn(async () => {}),
  };
});

// Mock server-only to prevent "Client Component module" errors in tests
vi.mock('server-only', () => {
  return {};
});

import '@testing-library/jest-dom/vitest';

// ── Per-test-file SQLite isolation hooks ────────────────────────────────
// Each node-environment test file gets a fresh DATA_DIR to prevent
// SQLite WAL contention. Uses createRequire to avoid module resolution
// issues in jsdom (where node builtins are stubbed).
// Wrapped in try/catch to gracefully skip when better-sqlite3 or node
// builtins are unavailable (jsdom component tests).
(function registerIsolationHooks() {
  try {
    const req = createRequire(import.meta.url);
    const iso = req('./test-db-isolation') as typeof import('./test-db-isolation');
    if (typeof iso.createTestDataDir !== 'function') return;

    const { createTestDataDir, cleanupTestDataDir } = iso;

    beforeAll(() => {
      createTestDataDir();
    });

    afterAll(async () => {
      await cleanupTestDataDir();
    });
  } catch {
    // jsdom or module unavailable — skip isolation hooks
  }
})();
