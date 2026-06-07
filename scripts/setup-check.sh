#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PASS="\x1b[32m\u2713\x1b[0m"
FAIL="\x1b[31m\u2717\x1b[0m"
ANY_FAILED=0

MIN_NODE_MAJOR=18
MIN_NODE_MINOR=17
MIN_NODE_VERSION="18.17.0"

# Check Node.js version
NODE_VERSION="$(node -p "process.versions.node" 2>/dev/null || echo "unknown")"
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_MINOR="$(node -p "process.versions.node.split('.')[1]" 2>/dev/null || echo "0")"

if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ] || { [ "$NODE_MAJOR" -eq "$MIN_NODE_MAJOR" ] && [ "$NODE_MINOR" -lt "$MIN_NODE_MINOR" ]; }; then
  echo -e "$FAIL Node.js version check failed"
  echo "  Found: $NODE_VERSION (required: $MIN_NODE_VERSION+)"
  echo "  Fix: Install Node.js v20+ from https://nodejs.org/ or use nvm to switch versions"
  ANY_FAILED=1
else
  echo -e "$PASS Node.js version $NODE_VERSION"
fi

# Check better-sqlite3
if ! bash ./scripts/ensure-better-sqlite3.sh >/dev/null 2>&1; then
  echo -e "$FAIL better-sqlite3 check failed"
  echo "  The native module could not be loaded or rebuilt."
  echo "  Fix: Run 'pnpm install' to install dependencies, or check that build tools (python, make, g++) are installed"
  ANY_FAILED=1
else
  echo -e "$PASS better-sqlite3 native module OK"
fi

# Check persistence root
if ! pnpm verify:persistence-root >/dev/null 2>&1; then
  echo -e "$FAIL Persistence root check failed"
  echo "  The .grant-ops-data/ directory is not writable."
  echo "  Fix: Ensure the current user has write permission to the project directory"
  ANY_FAILED=1
else
  echo -e "$PASS Persistence root writable"
fi

# Check build (skip rebuild if standalone artifacts already exist)
if [ -d "frontend/.next/standalone" ] && [ -n "$(find frontend/.next/standalone/frontend/.next/static/chunks/ -name 'main-*.js' -print -quit 2>/dev/null)" ]; then
  echo -e "$PASS Production build OK (existing artifacts)"
elif ! pnpm build >/dev/null 2>&1; then
  echo -e "$FAIL Build check failed"
  echo "  The Next.js production build did not complete."
  echo "  Fix: Check for TypeScript errors with 'pnpm typecheck' and lint errors with 'pnpm lint'"
  ANY_FAILED=1
else
  echo -e "$PASS Production build OK"
fi

if [ "$ANY_FAILED" -eq 1 ]; then
  echo ""
  echo "[setup-check] local setup verification FAILED — see errors above"
  exit 1
fi

echo "[setup-check] local setup verified"
