# Local Setup

## Prerequisites

- Node.js 20 or newer (24.x recommended)
- pnpm (canonical package manager — `npm install -g pnpm`)
- Native build tooling for `better-sqlite3` (python, make, g++)

## Verify the environment

```bash
bash scripts/setup-check.sh
```

This checks:
- Node.js version (uses `node -v` for compatibility with wrappers)
- pnpm availability
- better-sqlite3 native module loadability
- Persistence root writability
- Disk space (≥100MB free)
- Production build artifacts

## Start the app after verification

```bash
pnpm run start:verified
```

## Notes

- The app stores local data under the configured `DATA_DIR` (defaults to `.grant-ops-data/`).
- If `better-sqlite3` needs a rebuild, pnpm's `onlyBuiltDependencies` setting in `.pnpmrc` handles it automatically on `pnpm install`.
- The verification command checks the persistence root and build output before launch.
