#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[baseline] installing dependencies..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile
elif command -v npm >/dev/null 2>&1; then
  echo "[baseline] pnpm not found; falling back to npm install"
  npm install
else
  echo "[baseline] ERROR: Neither pnpm nor npm is available"
  exit 1
fi

echo "[baseline] ensuring better-sqlite3..."
if ! node -e "require('better-sqlite3')" >/dev/null 2>&1; then
  bash scripts/check-better-sqlite3.sh
fi

echo "=== typecheck ==="
npx tsc --noEmit -p frontend/tsconfig.json

echo "=== lint ==="
npx eslint . --ext .ts,.tsx

echo "=== unit tests ==="
npx vitest run

echo "=== knip ==="
npx knip

echo "=== grep checks ==="
# console.log outside logger.ts
if grep -rn 'console\.log' frontend/src/ --include='*.ts' --include='*.tsx' | grep -v logger.ts | grep -v __mocks__; then
  echo "FAIL: console.log found outside logger.ts"
  exit 1
fi

# @ts-ignore / @ts-expect-error / : any
if grep -rn '@ts-ignore\|@ts-expect-error\|: any\b' frontend/src/ --include='*.ts' --include='*.tsx'; then
  echo "FAIL: type safety violations found"
  exit 1
fi

# AI purple
if grep -rn '#7c3aed\|#8b5cf6\|#a855f7' frontend/src/; then
  echo "FAIL: AI purple colors found"
  exit 1
fi

# banned fonts in globals.css
if grep -rwn 'font-family.*Inter\|font-family.*Roboto\|font-family.*Arial\|font-family.*Space Grotesk' frontend/src/app/globals.css; then
  echo "FAIL: banned fonts found in globals.css"
  exit 1
fi

# SetupWizard
if grep -rn 'SetupWizard' frontend/src/; then
  echo "FAIL: SetupWizard references found"
  exit 1
fi

# getByTestId in tests
if grep -rn 'getByTestId\|getAllByTestId' frontend/src/ --include='*.ts' --include='*.tsx'; then
  echo "FAIL: getByTestId found in tests"
  exit 1
fi

echo "[baseline] ALL CHECKS PASSED"
