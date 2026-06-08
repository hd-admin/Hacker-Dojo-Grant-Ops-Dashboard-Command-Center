# 13 — Distribution & Onboarding

This document defines the single supported install path for Hacker Dojo
Grant Ops and the verification chain that proves a fresh operator
environment matches CI. It is the authoritative source for "how do I
get the app running on a clean clone".

## Single Supported Install Path

```bash
pnpm install        # rebuilds better-sqlite3 against the current Node ABI
pnpm dev            # starts the app on 127.0.0.1:3000
```

`npm install && npm run dev` is the documented alternative. There are
**no `predev` / `prebuild` / `prestart` / `pretest` / `prepare`
shims**. The `dev` script in `package.json` is a one-liner that
launches Next.js directly.

## Why no predev shim?

The original `ensure-better-sqlite3.sh` predev script was deleted
because:

1. It required a Node binary that the operator might not have on
   PATH (it failed with `could not resolve a real Node binary`).
2. It was redundant: pnpm's `onlyBuiltDependencies` setting in
   `.pnpmrc` already rebuilds `better-sqlite3` (and `esbuild`,
   `sharp`, `unrs-resolver`) against the current Node ABI on
   `pnpm install`.
3. The predev hook was the only thing standing between a clean
   `pnpm install && pnpm dev` and a working app.

The current setup is intentionally hook-free.

## Verification Chain (CI ≡ Operator)

The same checks the CI runs are available as standalone scripts:

```bash
bash scripts/setup-check.sh           # Node, scripts, env, db
bash scripts/check-better-sqlite3.sh  # node -e "require('better-sqlite3')"
pnpm typecheck                         # tsc --noEmit
pnpm lint                              # eslint
pnpm knip:check                        # dead-code audit (via `npx knip --production`)
pnpm test                              # bash run-test-batches.sh
pnpm test:abi                          # tests/abi-rebuild-guard.test.ts
pnpm test:no-xlsx                      # tests/no-xlsx-package.test.ts
```

A green output from every command above means the operator
environment is byte-equivalent to a clean CI run.

## E2E Onboarding Specs

The following Playwright specs cover the user-facing onboarding
contract:

- `tests/e2e/startup-verification.spec.ts` — verifies the dev server
  boots and `/api/health` returns 200 with `storage: ok`.
- `tests/e2e/fresh-user-onboarding.spec.ts` — simulates a brand-new
  operator: stages a clean working tree, wipes runtime state, runs
  `pnpm install` (or `npm install`), starts the dev server, and
  asserts `GET /` and `GET /api/health`. Skips on <2GB runners with
  an explicit reason.
- `tests/e2e/distribution-smoke.spec.ts` — runs the production
  build (`pnpm build`) and boots the standalone server on port 3010. Asserts `GET /` and `GET /api/health` against the bundled
  artifact. Skips on <2GB runners.

## ABI Rebuild Recipe

If `better-sqlite3` fails to load on a fresh install (the prebuilt
binary does not match the current Node ABI), the operator can run:

```bash
pnpm rebuild better-sqlite3
# or
npm rebuild better-sqlite3
```

The `tests/abi-rebuild-guard.test.ts` Vitest guard runs this rebuild
automatically on first failure and re-asserts the load. If the
rebuild does not fix the load, the test fails with the original
`NODE_MODULE_VERSION 137 vs 141` mismatch message so the operator
sees the real cause.

## Invariants

The following are enforced by automated checks and may not be
violated:

1. **No `xlsx` (SheetJS) dependency or import.** The
   `tests/no-xlsx-package.test.ts` guard fails the build on any
   `xlsx` re-introduction. Use `exceljs` for all `.xlsx` work.
2. **No `predev` / `prebuild` / `prestart` / `pretest` / `prepare`
   hook in `package.json` or `frontend/package.json`.** These
   hooks are a smell; if a hook is unavoidable, document it inline
   and prefer a check inside the dev script proper.
3. **No scripts/ensure-better-sqlite3.sh.** The verify-only
   successor is `scripts/check-better-sqlite3.sh`.
4. **`better-sqlite3` must load against the current Node ABI.** The
   `tests/abi-rebuild-guard.test.ts` guard is the canary.

## See Also

- `README.md` — Quick Start and "New in this version?" subsection.
- `scripts/check-better-sqlite3.sh` — the verify-only successor of
  the deleted predev shim.
- `tests/no-xlsx-package.test.ts` — the `xlsx` ban guard.
- `tests/abi-rebuild-guard.test.ts` — the ABI rebuild guard.
