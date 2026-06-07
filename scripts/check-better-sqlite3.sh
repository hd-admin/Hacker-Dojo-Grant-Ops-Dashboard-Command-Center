#!/bin/bash
# Verify the better-sqlite3 native binding loads.
# Exits 0 on success, 1 with a hint if require() fails.
set -euo pipefail
if node -e "require('better-sqlite3');" >/dev/null 2>&1; then
  exit 0
fi
echo 'better-sqlite3 failed to load. Run: pnpm install' >&2
exit 1
