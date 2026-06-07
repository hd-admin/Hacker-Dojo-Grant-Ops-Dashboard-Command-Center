#!/bin/bash
# setup-check.sh — verify the local development/production environment is ready.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PASS="\x1b[32m\u2713\x1b[0m"
FAIL="\x1b[31m\u2717\x1b[0m"
ANY_FAILED=0

MIN_NODE_MAJOR=20
MIN_NODE_VERSION="20.0.0"

# 1. Check Node.js version (use node -v for compatibility with wrappers)
NODE_VERSION="$(node -v 2>/dev/null || echo "unknown")"
# Strip a leading 'v' if present (some fake/mock node binaries report v16.0.0)
NODE_VERSION_CLEAN="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_VERSION_CLEAN%%.*}"

if [ "$NODE_VERSION" = "unknown" ] || [ -z "$NODE_VERSION_CLEAN" ] || [ "$NODE_MAJOR" = "" ]; then
  echo -e "$FAIL Node.js is not installed or not on PATH"
  echo "  Fix: Install Node.js v20+ from https://nodejs.org/ or use a version manager"
  ANY_FAILED=1
elif [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  echo -e "$FAIL Node.js version check failed"
  echo "  Found: $NODE_VERSION (required: $MIN_NODE_VERSION+)"
  echo "  Fix: Upgrade Node.js to v20+ and re-run this check"
  ANY_FAILED=1
else
  echo -e "$PASS Node.js version $NODE_VERSION"
fi

# 2. Check package manager is available (pnpm preferred, npm acceptable)
PKG_MANAGER=""
if command -v pnpm >/dev/null 2>&1; then
  PKG_MANAGER="pnpm"
  echo -e "$PASS pnpm is available ($(pnpm --version 2>/dev/null || echo 'unknown version'))"
elif command -v npm >/dev/null 2>&1; then
  PKG_MANAGER="npm"
  echo -e "$PASS npm is available ($(npm --version 2>/dev/null || echo 'unknown version')) (pnpm not found, npm is acceptable)"
else
  echo -e "$FAIL Neither pnpm nor npm is installed or not on PATH"
  echo "  Fix: Install pnpm: npm install -g pnpm"
  ANY_FAILED=1
fi

# 3. Check better-sqlite3 (use --skip-rebuild semantics via ensure script)
# If the native module already loads, ensure-better-sqlite3.sh exits 0 quickly without rebuilding.
if ! bash ./scripts/ensure-better-sqlite3.sh >/dev/null 2>&1; then
  echo -e "$FAIL better-sqlite3 check failed"
  echo "  The native module could not be loaded or rebuilt."
  echo "  Fix: Run 'pnpm install' to install dependencies, or check that build tools (python, make, g++) are installed"
  ANY_FAILED=1
else
  echo -e "$PASS better-sqlite3 native module OK"
fi

# 4. Check persistence root (zero-dependency: do not require pnpm or tsx)
DATA_DIR="$ROOT_DIR/.grant-ops-data"
mkdir -p "$DATA_DIR"
if [ -w "$DATA_DIR" ]; then
  echo -e "$PASS Persistence root writable"
else
  echo -e "$FAIL Persistence root check failed"
  echo "  The .grant-ops-data/ directory is not writable."
  echo "  Fix: Ensure the current user has write permission to the project directory"
  ANY_FAILED=1
fi

# 5. Disk space check for .grant-ops-data/ (require at least 100MB free)
# Uses df directly — no dependency on pnpm or tsx.
mkdir -p "$DATA_DIR"
FREE_KB=0
if command -v df >/dev/null 2>&1; then
  FREE_KB="$(df -k "$DATA_DIR" 2>/dev/null | awk 'NR==2 {print $4}')"
fi
MIN_FREE_KB=$((100 * 1024))
if [ -z "$FREE_KB" ] || [ "$FREE_KB" = "" ]; then
  echo -e "$FAIL Disk space check could not determine free space for $DATA_DIR"
  ANY_FAILED=1
elif [ "$FREE_KB" -lt "$MIN_FREE_KB" ]; then
  echo -e "$FAIL Disk space check failed"
  echo "  Free space: $((FREE_KB / 1024))MB (required: >=100MB) in $DATA_DIR"
  echo "  Fix: Free up disk space or set DATA_DIR to a partition with more space"
  ANY_FAILED=1
else
  echo -e "$PASS Disk space OK ($((FREE_KB / 1024))MB free in $DATA_DIR)"
fi

# 6. Check build (skip rebuild if standalone artifacts already exist)
if [ -d "frontend/.next/standalone" ] && [ -n "$(find frontend/.next/standalone/frontend/.next/static/chunks/ -name 'main-*.js' -print -quit 2>/dev/null || true)" ]; then
  echo -e "$PASS Production build OK (existing artifacts)"
else
  BUILD_CMD="${PKG_MANAGER:-pnpm} build"
  if ! $BUILD_CMD >/dev/null 2>&1; then
    echo -e "$FAIL Build check failed"
    echo "  The Next.js production build did not complete."
    echo "  Fix: Check for TypeScript errors with '${PKG_MANAGER:-pnpm} typecheck' and lint errors with '${PKG_MANAGER:-pnpm} lint'"
    ANY_FAILED=1
  else
    # Validate standalone directory exists after build
    if [ ! -d "frontend/.next/standalone" ]; then
      echo -e "$FAIL Build check failed"
      echo "  Build completed but frontend/.next/standalone/ is missing."
      echo "  Fix: Ensure next.config.js sets output: 'standalone'"
      ANY_FAILED=1
    else
      echo -e "$PASS Production build OK"
    fi
  fi
fi

if [ "$ANY_FAILED" -eq 1 ]; then
  echo ""
  echo "[setup-check] local setup verification FAILED — see errors above"
  exit 1
fi

echo "[setup-check] local setup verified"
