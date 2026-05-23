#!/bin/bash
set -euo pipefail

ROOT_DIR="/Users/mistlight/Projects/Experiments/HackerDojoGrantApp"
FRONTEND_DIR="$ROOT_DIR/frontend"

cd "$FRONTEND_DIR"
rm -rf .next
"$ROOT_DIR/node_modules/.bin/next" build
PORT=3000 HOSTNAME=0.0.0.0 exec "$ROOT_DIR/node_modules/.bin/next" start
