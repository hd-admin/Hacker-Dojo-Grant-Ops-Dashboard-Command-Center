#!/bin/bash
set -euo pipefail
ROOT_DIR="/Users/mistlight/Projects/Experiments/HackerDojoGrantApp"
export DATA_DIR="$ROOT_DIR/.grant-ops-data"
FRONTEND_DIR="$ROOT_DIR/frontend"

cd "$FRONTEND_DIR"
node -e "require('fs').rmSync('.next', { recursive: true, force: true })"
"$ROOT_DIR/node_modules/.bin/next" build
PORT=3000 HOSTNAME=0.0.0.0 exec "$ROOT_DIR/node_modules/.bin/next" start
