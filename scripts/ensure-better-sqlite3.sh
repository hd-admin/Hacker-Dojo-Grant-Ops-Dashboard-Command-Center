#!/bin/bash
# ensure-better-sqlite3.sh — resolve a real Node.js binary and ensure better-sqlite3 native bindings work.
#
# Platform notes:
# - Linux (apt/yum/nvm/snap/flatpak/pnpm): supported
# - macOS (Homebrew/nvm/pkg): supported
# - Windows (WSL/Git Bash): supported when node is on PATH or under NVM_DIR
# - Docker: ensure node is installed and on PATH
#
# If you see "could not resolve a real Node binary", run with --diagnose and share the output.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIAGNOSE=0
if [ "${1:-}" = "--diagnose" ]; then
  DIAGNOSE=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ensure-better-sqlite3-lib.sh
source "$SCRIPT_DIR/ensure-better-sqlite3-lib.sh"

if [ "$DIAGNOSE" -eq 1 ]; then
  echo "[ensure-better-sqlite3] resolving Node binary..." >&2
fi

REAL_NODE="$(resolve_real_node)"
if [ "$DIAGNOSE" -eq 1 ]; then
  echo "[ensure-better-sqlite3][diagnose] resolved real Node: $REAL_NODE ($("$REAL_NODE" -v))" >&2
  "$REAL_NODE" -e 'process.stdout.write(JSON.stringify(process.versions, null, 2))' >&2
  echo "" >&2
  exit 0
fi

echo "[ensure-better-sqlite3] resolved real Node: $REAL_NODE ($("$REAL_NODE" -v))" >&2

cd "$ROOT_DIR"
if ! "$REAL_NODE" -e "require.resolve('better-sqlite3/package.json')" >/dev/null 2>&1; then
  echo "[ensure-better-sqlite3] better-sqlite3 package not found; installing dependencies" >&2
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "[ensure-better-sqlite3] ERROR: pnpm is not installed and better-sqlite3 is missing." >&2
    echo "  Fix: Install pnpm (npm install -g pnpm) and run pnpm install." >&2
    exit 1
  fi
  pnpm install --frozen-lockfile --ignore-scripts
fi

PACKAGE_JSON_PATH="$("$REAL_NODE" -e "process.stdout.write(require.resolve('better-sqlite3/package.json'))")"
PACKAGE_DIR="$(dirname "$PACKAGE_JSON_PATH")"
LOCK_DIR="$PACKAGE_DIR/.ensure-better-sqlite3.lock"
NODE_MODULE_VERSION="$("$REAL_NODE" -e "process.stdout.write(process.versions.modules)")"
TARGET_PLATFORM="$("$REAL_NODE" -e "process.stdout.write(process.platform)")"
TARGET_ARCH="$("$REAL_NODE" -e "process.stdout.write(process.arch)")"

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

lock_wait_start="$(date +%s)"
while ! mkdir "$LOCK_DIR" 2>/dev/null; do
  if [ $(( $(date +%s) - lock_wait_start )) -ge 120 ]; then
    echo "[ensure-better-sqlite3] ERROR: timed out waiting for lock: $LOCK_DIR" >&2
    echo "  Another process may be rebuilding better-sqlite3. If not, delete $LOCK_DIR manually." >&2
    exit 1
  fi
  sleep 0.2
done
trap cleanup EXIT

if "$REAL_NODE" -e "const Database=require('better-sqlite3');const db=new Database(':memory:');db.prepare('select 1').get();db.close();" >/dev/null 2>&1; then
  echo "[ensure-better-sqlite3] better-sqlite3 already works with $REAL_NODE" >&2
  exit 0
fi

# Before rebuilding from source, try to restore any backup binding nearby.
# This is useful in test environments where the binding was intentionally
# renamed to .bak and should be recovered without a full node-gyp compile.
restore_binding_from_backup() {
  local package_dir="$1"
  local candidates=(
    "$package_dir/build/Release/better_sqlite3.node.bak"
    "$package_dir/lib/binding/node-v${NODE_MODULE_VERSION}-${TARGET_PLATFORM}-${TARGET_ARCH}/better_sqlite3.node.bak"
  )
  for candidate in "${candidates[@]}"; do
    if [ -f "$candidate" ]; then
      local target
      target="${candidate%.bak}"
      cp -f "$candidate" "$target"
      if "$REAL_NODE" -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('select 1').get(); db.close();" >/dev/null 2>&1; then
        echo "[ensure-better-sqlite3] restored better-sqlite3 from backup: $candidate" >&2
        return 0
      fi
      # If the backup didn't work, remove the copied file so rebuild can proceed
      rm -f "$target"
    fi
  done
  return 1
}

if restore_binding_from_backup "$PACKAGE_DIR"; then
  exit 0
fi

if ! command -v node-gyp >/dev/null 2>&1 && [ ! -x "$ROOT_DIR/node_modules/.bin/node-gyp" ]; then
  echo "[ensure-better-sqlite3] ERROR: node-gyp is not available. Cannot rebuild better-sqlite3." >&2
  echo "  Fix: Install build dependencies (python, make, g++) and run pnpm install." >&2
  exit 1
fi

echo "[ensure-better-sqlite3] rebuilding better-sqlite3 for $("$REAL_NODE" -v) (modules=$NODE_MODULE_VERSION)" >&2
cd "$ROOT_DIR"
mkdir -p "$PACKAGE_DIR/build"
cd "$PACKAGE_DIR"
"$REAL_NODE" "$ROOT_DIR/node_modules/.bin/node-gyp" configure --release
mkdir -p "$PACKAGE_DIR/build/node_gyp_bins"
BUILD_LOG="$PACKAGE_DIR/build-release.log"
if ! "$REAL_NODE" "$ROOT_DIR/node_modules/.bin/node-gyp" build --release >"$BUILD_LOG" 2>&1; then
  if grep -q 'build/node_gyp_bins' "$BUILD_LOG"; then
    echo "[ensure-better-sqlite3] node-gyp reported a recoverable build/node_gyp_bins cleanup error; continuing with built artifact validation" >&2
    tail -n 20 "$BUILD_LOG" >&2
  else
    echo "[ensure-better-sqlite3] ERROR: node-gyp build failed. See $BUILD_LOG for details." >&2
    cat "$BUILD_LOG" >&2
    exit 1
  fi
fi
mkdir -p "$PACKAGE_DIR/lib/binding/node-v${NODE_MODULE_VERSION}-${TARGET_PLATFORM}-${TARGET_ARCH}"
ln -sf "$PACKAGE_DIR/build/Release/better_sqlite3.node" "$PACKAGE_DIR/lib/binding/node-v${NODE_MODULE_VERSION}-${TARGET_PLATFORM}-${TARGET_ARCH}/better_sqlite3.node"
if ! "$REAL_NODE" -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('select 1').get(); db.close();" >/dev/null 2>&1; then
  echo "[ensure-better-sqlite3] ERROR: rebuild completed but better-sqlite3 still fails to load." >&2
  exit 1
fi
echo "[ensure-better-sqlite3] rebuild successful" >&2
