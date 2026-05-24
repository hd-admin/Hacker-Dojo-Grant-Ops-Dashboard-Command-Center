#!/bin/bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DATA_DIR="$ROOT_DIR/.grant-ops-data"
FRONTEND_DIR="$ROOT_DIR/frontend"

if ! node -e "const Database=require('better-sqlite3');const db=new Database(':memory:');db.prepare('select 1').get();db.close();"; then
  bash "$ROOT_DIR/scripts/ensure-better-sqlite3.sh"
fi

cd "$FRONTEND_DIR"
# Ensure a valid production build exists by checking for the server build output
if [ ! -f ".next/BUILD_ID" ] || [ ! -d ".next/server" ] || [ ! -f ".next/server/middleware-manifest.json" ]; then
  echo "[playwright-start.sh] No valid production build found, rebuilding..." >&2
  "$ROOT_DIR/node_modules/.bin/next" build
fi

exec env DATA_DIR="$DATA_DIR" PORT=3000 HOSTNAME=0.0.0.0 "$ROOT_DIR/node_modules/.bin/next" start
