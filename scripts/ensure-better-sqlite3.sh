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
SKIP_IF_WORKING=0
if [ "${1:-}" = "--diagnose" ]; then
  DIAGNOSE=1
elif [ "${1:-}" = "--skip-if-working" ]; then
  SKIP_IF_WORKING=1
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
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile --ignore-scripts
  elif command -v npm >/dev/null 2>&1; then
    echo "[ensure-better-sqlite3] pnpm not found; falling back to npm install" >&2
    npm install --ignore-scripts
  else
    echo "[ensure-better-sqlite3] ERROR: Neither pnpm nor npm is installed and better-sqlite3 is missing." >&2
    echo "  Fix: Install pnpm (npm install -g pnpm) or npm, then run install." >&2
    exit 1
  fi
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

if [ "$SKIP_IF_WORKING" -eq 1 ]; then
  echo "[ensure-better-sqlite3] better-sqlite3 does not work; proceeding with rebuild (--skip-if-working was passed but module is not functional)" >&2
fi

# ── Detect containerized environments ────────────────────────────────────
# Snap, Flatpak, and chroot environments often lack build tools or have
# restricted filesystem access that prevents node-gyp rebuild. Detect them
# early and emit a clear error with remediation steps.
detect_containerized_environment() {
  local container_type=""
  local remediation=""

  # Snap detection
  if [ -n "${SNAP:-}" ] || [ -n "${SNAP_NAME:-}" ] || [ -n "${SNAP_VERSION:-}" ]; then
    container_type="snap"
  elif echo "$REAL_NODE" | grep -qE '(snap|/snap/)' 2>/dev/null; then
    container_type="snap"
  fi

  # Flatpak detection
  if [ -z "$container_type" ] && [ -n "${FLATPAK_ID:-}" ]; then
    container_type="flatpak"
  elif [ -z "$container_type" ] && [ -f "/.flatpak-info" ]; then
    container_type="flatpak"
  fi

  # Chroot detection
  if [ -z "$container_type" ]; then
    local proc1_root
    proc1_root="$(readlink -f /proc/1/root 2>/dev/null || echo "")"
    if [ -n "$proc1_root" ] && [ "$proc1_root" != "/" ]; then
      container_type="chroot"
    fi
  fi

  if [ -n "$container_type" ]; then
    case "$container_type" in
      snap)
        remediation="Snap-confined Node.js cannot run node-gyp builds. Remediation options:
  1. Install Node.js outside of snap (e.g. via nvm, fnm, or the NodeSource apt repo).
  2. Install build-essential inside the snap if the snap exposes it.
  3. Use a prebuilt better-sqlite3 binding that matches your platform and arch."
        ;;
      flatpak)
        remediation="Flatpak cannot compile native modules. Remediation options:
  1. Install Node.js on the host system (outside Flatpak).
  2. Use a prebuilt better-sqlite3 binding that matches your platform and arch."
        ;;
      chroot)
        remediation="Chroot environment detected. Build tools may be missing. Remediation options:
  1. Install build-essential, python3, and make inside the chroot.
  2. Bind-mount the host's node_modules into the chroot.
  3. Use a prebuilt better-sqlite3 binding that matches your platform and arch."
        ;;
    esac
    echo "[ensure-better-sqlite3] ERROR: Detected $container_type environment. Cannot rebuild better-sqlite3." >&2
    echo "  $remediation" >&2
    return 0
  fi
  return 1
}

# ── Prebuilt binding detection ───────────────────────────────────────────
# better-sqlite3 ships prebuilt binaries for common platforms. If a matching
# prebuild exists, copy it to the expected binding path instead of compiling.
try_prebuilt_binding() {
  local package_dir="$1"
  local prebuilds_dir="$package_dir/prebuilds"
  local target_pattern="${TARGET_PLATFORM}-${TARGET_ARCH}"
  local binding_target="$package_dir/lib/binding/node-v${NODE_MODULE_VERSION}-${TARGET_PLATFORM}-${TARGET_ARCH}/better_sqlite3.node"

  if [ ! -d "$prebuilds_dir" ]; then
    return 1
  fi

  # Look for a directory matching the target platform-arch
  local match_dir=""
  for dir in "$prebuilds_dir"/*; do
    if [ -d "$dir" ]; then
      local basename_dir
      basename_dir="$(basename "$dir")"
      if echo "$basename_dir" | grep -qE "^${TARGET_PLATFORM}-${TARGET_ARCH}$"; then
        match_dir="$dir"
        break
      fi
    fi
  done

  if [ -z "$match_dir" ]; then
    return 1
  fi

  # Look for the .node file inside the matched directory
  local node_file=""
  for f in "$match_dir"/*.node; do
    if [ -f "$f" ]; then
      node_file="$f"
      break
    fi
  done

  if [ -z "$node_file" ]; then
    return 1
  fi

  mkdir -p "$(dirname "$binding_target")"
  cp -f "$node_file" "$binding_target"

  # Verify the copied binding loads
  if "$REAL_NODE" -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('select 1').get(); db.close();" >/dev/null 2>&1; then
    echo "[ensure-better-sqlite3] installed prebuilt binding from $node_file" >&2
    return 0
  fi

  # If the prebuilt binding didn't work, remove it so rebuild can proceed
  rm -f "$binding_target"
  return 1
}

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

# Try prebuilt bindings before any rebuild
if try_prebuilt_binding "$PACKAGE_DIR"; then
  exit 0
fi

# Check for containerized environments before attempting node-gyp rebuild
if detect_containerized_environment; then
  echo "[ensure-better-sqlite3] ERROR: better-sqlite3 cannot be rebuilt in this environment." >&2
  echo "  No prebuilt binding was found for ${TARGET_PLATFORM}-${TARGET_ARCH}." >&2
  echo "  Please install build tools or use a supported environment." >&2
  exit 1
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
