#!/bin/bash
# Wrapper script for pnpm verify to run verification steps sequentially
# This script is more observable to execution brokers than a long && chain

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "=== VERIFY STEP 1: lint ==="
pnpm lint
echo "✓ lint passed"

echo "=== VERIFY STEP 2: build ==="
pnpm build
echo "✓ build passed"

echo "=== VERIFY STEP 3: typecheck ==="
pnpm typecheck
echo "✓ typecheck passed"

echo "=== VERIFY STEP 4: test ==="
pnpm test
echo "✓ test passed"

echo "=== VERIFY STEP 5: test:e2e ==="
pnpm test:e2e
echo "✓ test:e2e passed"

echo ""
echo "=== ALL VERIFICATION PASSED ==="
exit 0
