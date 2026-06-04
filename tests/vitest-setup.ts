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

    // Per-file afterAll cleanup is intentionally omitted.
    // Keeping the SQLite database open and initialized across test files
    // avoids repeated schema creation, migration runs, and re-seeding —
    // the primary cause of the full-suite timeout. Each test file is
    // responsible for setting up the data it needs. Connections are
    // closed on process exit via the SIGINT/SIGTERM handler in
    // shared/grant-ops-sqlite.ts.
  } catch {
    // jsdom or module unavailable — skip isolation hooks
  }
})();
