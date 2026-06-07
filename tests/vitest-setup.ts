// ── Per-test-suite SQLite DB isolation ──────────────────────────────────
// Set a unique DATA_DIR before any test module loads resolveDataDir().
// fileParallelism:false ensures sequential execution.
// Each test file resets SQLite state before and after, sharing one
// DATA_DIR per suite to avoid 177x filesystem create/destroy overhead.
if (typeof process !== 'undefined' && process.env) {
  const tmpRoot = process.env.TMPDIR ?? '/tmp/vitest';
  if (!process.env.DATA_DIR) {
    process.env.DATA_DIR = `${tmpRoot}/vitest-db-${Date.now()}`;
  }
}

import { createRequire } from 'node:module';
import path from 'node:path';

// better-sqlite3 sanity check.
// The vitest config's `environment: 'node'` loads this setup file in node,
// but tests that pin `@vitest-environment jsdom` cause Vite to re-evaluate
// imports through its browser-style pipeline and externalize `node:module`,
// so a direct createRequire from this file may throw in jsdom-only test
// files. The check is best-effort: if the binding loads we confirm with a
// SELECT 1 round-trip, otherwise we log a hint and continue. Tests that
// actually need better-sqlite3 will surface a real failure when the binding
// is missing.
try {
  const req = createRequire(path.join(process.cwd(), 'noop.js'));
  const Database = req('better-sqlite3') as new (filename: string) => {
    prepare: (sql: string) => {
      get: () => unknown;
    };
    close: () => void;
  };
  const db = new Database(':memory:');
  db.prepare('select 1').get();
  db.close();
} catch {
  // better-sqlite3 is not loadable from this test environment.
  // pnpm's onlyBuiltDependencies setting in .pnpmrc rebuilds the binding
  // automatically on 'pnpm install'. The node CLI check at
  // scripts/check-better-sqlite3.sh is the canonical sanity check.
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

// ── Per-test-file SQLite state reset hooks ─────────────────────────────
// Each node-environment test file resets SQLite state before and after
// to prevent cross-test contamination. Reuses the suite-level DATA_DIR
// set above instead of creating a new directory per file.
// Wrapped in try/catch to gracefully skip when better-sqlite3 or node
// builtins are unavailable (jsdom component tests).
(function registerIsolationHooks() {
  try {
    const req = createRequire(import.meta.url);
    const iso = req('./test-db-isolation') as typeof import('./test-db-isolation');
    if (typeof iso.createTestDataDir !== 'function') return;

    const { createTestDataDir } = iso;

    // Reset global dependencies state from previous test files.
    // This prevents stale setDependencies() state from one file
    // leaking into the next file, which causes hangs when the
    // stale deps reference a cleaned-up DATA_DIR.
    let resetDeps: (() => void) | null = null;
    let resetActiveJobs: (() => void) | null = null;
    try {
      const depsMod = req('../frontend/src/server/grant-ops/dependencies') as {
        resetDependencies: () => void;
      };
      if (typeof depsMod.resetDependencies === 'function') {
        resetDeps = depsMod.resetDependencies;
      }
    } catch {
      // dependencies module unavailable (e.g. jsdom) — skip
    }
    try {
      const agentLoopMod = req('../frontend/src/server/grant-ops/agent-loop') as {
        resetActiveJobs: () => void;
      };
      if (typeof agentLoopMod.resetActiveJobs === 'function') {
        resetActiveJobs = agentLoopMod.resetActiveJobs;
      }
    } catch {
      // agent-loop module unavailable (e.g. jsdom) — skip
    }

    beforeEach(() => {
      createTestDataDir();
      if (resetDeps) resetDeps();
      if (resetActiveJobs) resetActiveJobs();
    });

    // Close all SQLite connections after each test file to prevent
    // better-sqlite3 native memory growth from accumulating across
    // the 135+ test files in the full suite. The per-file overhead
    // of reopening the DB is offset by keeping a single DATA_DIR per
    // suite and letting each file re-open against the already-seeded DB.
    afterAll(() => {
      try {
        const sqliteMod = req('../shared/grant-ops-sqlite') as typeof import('../shared/grant-ops-sqlite');
        if (typeof sqliteMod.resetSqliteCache === 'function') {
          sqliteMod.resetSqliteCache();
        }
      } catch {
        // SQLite module unavailable in jsdom environment — skip
      }
    });
  } catch {
    // jsdom or module unavailable — skip isolation hooks
  }
})();
