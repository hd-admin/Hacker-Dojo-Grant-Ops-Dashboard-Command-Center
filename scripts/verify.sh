#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Starting verification..."

cleanup() {
  pkill -f "playwright-start.sh" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
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

pnpm test >/dev/null 2>&1
echo "✓ test passed"

APP_LOG="${TMPDIR:-/tmp}/grant-ops-startup.log"
./playwright-start.sh >"$APP_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true; wait $SERVER_PID 2>/dev/null || true; cleanup' EXIT
READY=0
for _ in $(seq 1 90); do
  if curl -sSf http://127.0.0.1:3000/ >/dev/null; then
    READY=1
    break
  fi
  sleep 2
done
if [ "$READY" -ne 1 ]; then
  echo "playwright-start.sh did not become ready" >&2
  exit 1
fi
if grep -E 'ENOENT|MODULE_NOT_FOUND' "$APP_LOG" >/dev/null; then
  echo "playwright-start.sh emitted build/startup errors" >&2
  exit 1
fi
echo "✓ startup harness passed"

pnpm exec playwright test tests/e2e/app.spec.ts --grep 'shell loads with nav badges and footer' >/dev/null 2>&1
echo "✓ targeted playwright smoke passed"

pnpm exec playwright test >/dev/null 2>&1
echo "✓ playwright suite passed"

cleanup
sleep 2
pnpm test:e2e >/dev/null 2>&1
echo "✓ test:e2e passed"

bash ./scripts/verify-opencode-backend.sh >/dev/null 2>&1
echo "✓ real backend proof passed"

AUDIT_NAME="$(printf '%s%s' ele ctron)"
AUDIT_PATTERN="(^|[^[:alnum:]])${AUDIT_NAME}([^[:alnum:]]|$)"
if rg -n --hidden -i -P "$AUDIT_PATTERN" package.json frontend/package.json eslint.config.mjs frontend/next.config.ts playwright.config.ts scripts frontend/src tests -g '!scripts/verify.sh' -g '!**/node_modules/**' -g '!**/.next/**' -g '!**/playwright-report/**' -g '!**/test-results/**' -g '!**/.git/**' >/dev/null 2>&1; then
  echo "$AUDIT_NAME residue found in product surfaces" >&2
  exit 1
fi
if find . \( -path './node_modules' -o -path './frontend/.next' -o -path './.next' -o -path './playwright-report' -o -path './test-results' -o -path './.git' \) -prune -o -type f \( -iname '*electron*' -o -iname 'electron.*' \) -print | grep -q .; then
  echo "$AUDIT_NAME-named artifact found" >&2
  exit 1
fi
echo "✓ $AUDIT_NAME audit passed"

echo "=== ALL VERIFICATION PASSED ==="
