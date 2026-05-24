#!/bin/bash
set -euo pipefail

cd /Users/mistlight/Projects/Experiments/HackerDojoGrantApp

echo "Starting verification..."

cleanup() {
  pkill -f "playwright-start.sh" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
}
trap cleanup EXIT

# Kill any existing Next.js server on port 3000 before running tests
cleanup
sleep 1

pnpm lint > /dev/null 2>&1
echo "✓ lint passed"

pnpm typecheck > /dev/null 2>&1
echo "✓ typecheck passed"

pnpm test > /dev/null 2>&1
echo "✓ test passed"

cleanup
pnpm test:e2e > /dev/null 2>&1
echo "✓ test:e2e passed"

echo "=== ALL VERIFICATION PASSED ==="
