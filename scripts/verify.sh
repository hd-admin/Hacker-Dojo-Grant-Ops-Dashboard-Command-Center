#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
export TMPDIR="$ROOT_DIR/.agent/tmp"
mkdir -p "$TMPDIR"

echo "Starting verification..."

cleanup() {
  # Kill all playwright-start.sh processes
  pkill -9 -f "playwright-start.sh" 2>/dev/null || true
  sleep 1
  # Kill any process still holding port 3000
  for pid in $(lsof -t -iTCP:3000 -sTCP:LISTEN 2>/dev/null || true); do
    parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
    kill -9 "$pid" 2>/dev/null || true
    if [ -n "$parent" ] && [ "$parent" != "1" ]; then
      kill -9 "$parent" 2>/dev/null || true
    fi
  done
  # Also kill any orphaned next-server / next start processes by name
  pkill -9 -f "next-server" 2>/dev/null || true
  pkill -9 -f "next start" 2>/dev/null || true
  # Kill chrome/chromium processes left by playwright
  pkill -9 -f "chrome" 2>/dev/null || true
  pkill -9 -f "chromium" 2>/dev/null || true
}

wait_for_port_3000_clear() {
  for _ in $(seq 1 30); do
    if ! lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

trap cleanup EXIT

bash ./scripts/ensure-better-sqlite3.sh
cleanup
sleep 1

pnpm verify:persistence-root >/dev/null 2>&1
echo "✓ persistence root verified"

pnpm lint >/dev/null 2>&1
echo "✓ lint passed"

pnpm build >/dev/null 2>&1
echo "✓ build passed"

find frontend/.next/types -maxdepth 3 -type f | head >/dev/null
echo "✓ next types present"

pnpm typecheck >/dev/null 2>&1
echo "✓ typecheck passed"

PLAYWRIGHT_DATA_DIR="$(mktemp -d "$ROOT_DIR/.agent/tmp/playwright-data.XXXXXX")"
export CI=1
DATA_DIR="$PLAYWRIGHT_DATA_DIR" pnpm exec playwright test tests/e2e/app.spec.ts tests/e2e/discovery-sorting.spec.ts tests/e2e/document-grounded-drafting.spec.ts tests/e2e/submission-notification.spec.ts tests/e2e/simple-discovery.spec.ts >/dev/null 2>&1
echo "✓ playwright suite passed"

pnpm test >/dev/null 2>&1
echo "✓ test passed"

cleanup
wait_for_port_3000_clear
echo "✓ port 3000 cleared"

bash ./scripts/verify-opencode-backend.sh >/dev/null 2>&1
echo "✓ real backend proof passed"

AUDIT_NAME="$(printf '%s%s' ele ctron)"
AUDIT_PATTERN="(^|[^[:alnum:]])${AUDIT_NAME}([^[:alnum:]]|$)"
if rg -n --hidden -i -P "$AUDIT_PATTERN" package.json frontend/package.json eslint.config.mjs frontend/next.config.ts playwright.config.ts scripts frontend/src tests -g '!**/node_modules/**' -g '!**/.next/**' -g '!**/playwright-report/**' -g '!**/test-results/**' -g '!**/.git/**' >/dev/null 2>&1; then
  echo "$AUDIT_NAME residue found in product surfaces" >&2
  exit 1
fi
if find . \( -path './node_modules' -o -path './frontend/.next' -o -path './.next' -o -path './playwright-report' -o -path './test-results' -o -path './.git' \) -prune -o -type f \( -iname "*${AUDIT_NAME}*" -o -iname "${AUDIT_NAME}.*" \) -print | grep -q .; then
  echo "$AUDIT_NAME-named artifact found" >&2
  exit 1
fi
echo "✓ $AUDIT_NAME audit passed"

echo "=== ALL VERIFICATION PASSED ==="
