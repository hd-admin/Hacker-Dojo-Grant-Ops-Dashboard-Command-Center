# Local Setup

## Prerequisites

- Node.js 18.17 or newer
- pnpm
- Native build tooling for `better-sqlite3`

## Verify the environment

```bash
bash scripts/setup-check.sh
```

## Start the app after verification

```bash
pnpm run start:verified
```

## Notes

- The app stores local data under the configured `DATA_DIR`.
- If `better-sqlite3` needs a rebuild, `scripts/ensure-better-sqlite3.sh` handles it.
- The verification command checks the persistence root and build output before launch.
