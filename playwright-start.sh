#!/bin/bash
set -euo pipefail
ROOT_DIR="/Users/mistlight/Projects/Experiments/HackerDojoGrantApp"
export DATA_DIR="$ROOT_DIR/.grant-ops-data"
FRONTEND_DIR="$ROOT_DIR/frontend"

cd "$FRONTEND_DIR"
# Skip rebuild if .next already exists (pnpm build already ran)
if [ ! -d ".next" ]; then
  "$ROOT_DIR/node_modules/.bin/next" build
fi

exec env PORT=3000 HOSTNAME=0.0.0.0 "$ROOT_DIR/node_modules/.bin/next" start
