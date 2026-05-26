#!/bin/bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DATA_DIR="${DATA_DIR:-$ROOT_DIR/.grant-ops-data}"
APP_PORT="${PORT:-3000}"
mkdir -p "$DATA_DIR"
FRONTEND_DIR="$ROOT_DIR/frontend"
PID_FILE="$DATA_DIR/playwright-start.pid"
printf '%s\n' "$$" > "$PID_FILE"

cleanup() {
  rm -f "$PID_FILE" 2>/dev/null || true
  sleep 1
  for pid in $(lsof -t -iTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null || true); do
    parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
    kill -9 "$pid" 2>/dev/null || true
    if [ -n "$parent" ] && [ "$parent" != "1" ]; then
      kill -9 "$parent" 2>/dev/null || true
    fi
  done
  pkill -9 -f "next-server" 2>/dev/null || true
  pkill -9 -f "next start" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
trap '' HUP

if ! node -e "const Database=require('better-sqlite3');const db=new Database(':memory:');db.prepare('select 1').get();db.close();"; then
  bash "$ROOT_DIR/scripts/ensure-better-sqlite3.sh"
  rm -rf "$FRONTEND_DIR/.next"
fi

cd "$FRONTEND_DIR"
# Ensure a valid production build exists by checking for the server build output
if [ ! -f ".next/BUILD_ID" ] || [ ! -d ".next/server" ] || [ ! -f ".next/server/middleware-manifest.json" ]; then
  echo "[playwright-start.sh] No valid production build found, rebuilding..." >&2
  rm -rf "$FRONTEND_DIR/.next"
  "$ROOT_DIR/node_modules/.bin/next" build
fi

exec env DATA_DIR="$DATA_DIR" PORT="$APP_PORT" HOSTNAME=0.0.0.0 OPENCODE_BIN="${OPENCODE_BIN:-}" OPENCODE_PURE="${OPENCODE_PURE:-}" "$ROOT_DIR/node_modules/.bin/next" start
