#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

resolve_real_node() {
  local candidate
  # Prefer the node from PATH that nvm or similar tools set,
  # but validate it is a real ELF binary, not a Bun/Deno shim.
  candidate="$(which node 2>/dev/null || echo "")"
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    # Check it isn't a Bun-style symlink shim
    local link_target
    link_target="$(readlink -f "$candidate" 2>/dev/null || echo "$candidate")"
    if file "$link_target" 2>/dev/null | grep -qi 'elf' && is_real_node "$link_target"; then
      echo "$link_target"
      return 0
    fi
  fi
  # Fallback: check /usr/bin/node
  if [ -x /usr/bin/node ]; then
    local usr_link
    usr_link="$(readlink -f /usr/bin/node 2>/dev/null || echo "/usr/bin/node")"
    if file "$usr_link" 2>/dev/null | grep -qi 'elf' && is_real_node "$usr_link"; then
      echo "$usr_link"
      return 0
    fi
  fi
  # Last resort: try /usr/local/bin/node
  if [ -x /usr/local/bin/node ] && is_real_node "/usr/local/bin/node"; then
    echo "/usr/local/bin/node"
    return 0
  fi
  echo "" >&2
  echo "[ensure-better-sqlite3] ERROR: could not resolve a real Node binary" >&2
  exit 1
}

is_real_node() {
  # Returns 0 if $1 is a genuine Node.js binary (not Bun/Deno shim).
  # Bun's node shim sets process.isBun=true and process.versions.bun.
  # Real Node.js has neither.
  local node_bin="$1"
  local check_output
  check_output="$("$node_bin" -e 'process.stdout.write(process.isBun ? "bun" : process.versions.bun ? "bun" : process.release?.name === "node" ? "node" : "unknown")' 2>/dev/null || echo 'error')"
  [ "$check_output" = "node" ]
}

REAL_NODE="$(resolve_real_node)"
echo "[ensure-better-sqlite3] resolved real Node: $REAL_NODE ($($REAL_NODE -v))" >&2

cd "$ROOT_DIR"
if ! "$REAL_NODE" -e "require.resolve('better-sqlite3/package.json')" >/dev/null 2>&1; then
  echo "[ensure-better-sqlite3] installing dependencies" >&2
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
    echo "[ensure-better-sqlite3] timed out waiting for lock: $LOCK_DIR" >&2
    exit 1
  fi
  sleep 0.2
done
trap cleanup EXIT

if "$REAL_NODE" -e "const Database=require('better-sqlite3');const db=new Database(':memory:');db.prepare('select 1').get();db.close();" >/dev/null 2>&1; then
  echo "[ensure-better-sqlite3] better-sqlite3 already works with $REAL_NODE" >&2
  exit 0
fi

echo "[ensure-better-sqlite3] rebuilding better-sqlite3 for $($REAL_NODE -v) (modules=$NODE_MODULE_VERSION)" >&2
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
    cat "$BUILD_LOG" >&2
    exit 1
  fi
fi
mkdir -p "$PACKAGE_DIR/lib/binding/node-v${NODE_MODULE_VERSION}-${TARGET_PLATFORM}-${TARGET_ARCH}"
ln -sf "$PACKAGE_DIR/build/Release/better_sqlite3.node" "$PACKAGE_DIR/lib/binding/node-v${NODE_MODULE_VERSION}-${TARGET_PLATFORM}-${TARGET_ARCH}/better_sqlite3.node"
"$REAL_NODE" -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('select 1').get(); db.close();" >/dev/null 2>&1
echo "[ensure-better-sqlite3] rebuild successful" >&2
