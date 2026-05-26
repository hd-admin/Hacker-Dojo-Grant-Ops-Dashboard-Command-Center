#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Use the default node in PATH, not a specific homebrew node
# Using homebrew/node@24 could cause NODE_MODULE_VERSION mismatch

PACKAGE_JSON_PATH="$(node -e "process.stdout.write(require.resolve('better-sqlite3/package.json'))")"
PACKAGE_DIR="$(dirname "$PACKAGE_JSON_PATH")"
LOCK_DIR="$PACKAGE_DIR/.ensure-better-sqlite3.lock"
NODE_MODULE_VERSION="$(node -e "process.stdout.write(process.versions.modules)")"
TARGET_PLATFORM="$(node -e "process.stdout.write(process.platform)")"
TARGET_ARCH="$(node -e "process.stdout.write(process.arch)")"

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

lock_wait_start="$(date +%s)"
while ! mkdir "$LOCK_DIR" 2>/dev/null; do
  if [ $(( $(date +%s) - lock_wait_start )) -ge 120 ]; then
    echo "[ensure-better-sqlite3] timed out waiting for lock: $LOCK_DIR" >&2
    exit 1
  fi
  sleep 0.2
done
trap cleanup EXIT

if node -e "const Database=require('better-sqlite3');const db=new Database(':memory:');db.prepare('select 1').get();db.close();" >/dev/null 2>&1; then
  exit 0
fi

echo "[ensure-better-sqlite3] rebuilding better-sqlite3 for $(node -v)" >&2
cd "$ROOT_DIR"
mkdir -p "$PACKAGE_DIR/build"
cd "$PACKAGE_DIR"
"$ROOT_DIR/node_modules/.bin/node-gyp" configure --release
mkdir -p "$PACKAGE_DIR/build/node_gyp_bins"
BUILD_LOG="$PACKAGE_DIR/build-release.log"
if ! "$ROOT_DIR/node_modules/.bin/node-gyp" build --release >"$BUILD_LOG" 2>&1; then
  if grep -q 'build/node_gyp_bins' "$BUILD_LOG"; then
    echo "[ensure-better-sqlite3] node-gyp reported a recoverable build/node_gyp_bins cleanup error; continuing with built artifact validation" >&2
    tail -n 20 "$BUILD_LOG" >&2
  else
    cat "$BUILD_LOG" >&2
    exit 1
  fi
fi
mkdir -p "$PACKAGE_DIR/lib/binding/node-v${NODE_MODULE_VERSION}-${TARGET_PLATFORM}-${TARGET_ARCH}"
ln -sf "$PACKAGE_DIR/build/Release/better_sqlite3.node" "$PACKAGE_DIR/lib/binding/node-v${NODE_MODULE_VERSION}-${TARGET_PLATFORM}-${TARGET_ARCH}/better_sqlite3.node"
node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('select 1').get(); db.close();" >/dev/null 2>&1
