#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MIN_NODE_MAJOR=18
MIN_NODE_MINOR=17
MIN_NODE_VERSION="18.17.0"
NODE_VERSION="$(node -p "process.versions.node")"
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_MINOR="$(node -p "process.versions.node.split('.')[1]")"

if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ] || { [ "$NODE_MAJOR" -eq "$MIN_NODE_MAJOR" ] && [ "$NODE_MINOR" -lt "$MIN_NODE_MINOR" ]; }; then
  echo "[setup-check] Node.js $MIN_NODE_VERSION+ required; found $NODE_VERSION" >&2
  exit 1
fi

bash ./scripts/ensure-better-sqlite3.sh
pnpm verify:persistence-root >/dev/null
pnpm build >/dev/null

echo "[setup-check] local setup verified"
