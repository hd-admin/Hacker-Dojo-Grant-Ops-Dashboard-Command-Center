#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if node -e "require('better-sqlite3')" >/dev/null 2>&1; then
  exit 0
fi

echo "[ensure-better-sqlite3] rebuilding better-sqlite3 for $(node -v)" >&2
cd "$ROOT_DIR"
pnpm rebuild better-sqlite3
node -e "require('better-sqlite3')" >/dev/null 2>&1
