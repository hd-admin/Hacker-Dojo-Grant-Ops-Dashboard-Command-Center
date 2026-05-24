#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[ensure-better-sqlite3] rebuilding better-sqlite3 for $(node -v)" >&2
PACKAGE_JSON_PATH="$(node -e "process.stdout.write(require.resolve('better-sqlite3/package.json'))")"
PACKAGE_DIR="$(dirname "$PACKAGE_JSON_PATH")"
NODE_GYP_BIN="$(node -e "process.stdout.write(require.resolve('node-gyp/bin/node-gyp.js'))")"
cd "$PACKAGE_DIR"
rm -rf build
mkdir -p build/node_gyp_bins
node "$NODE_GYP_BIN" rebuild --release
node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('select 1').get(); db.close();" >/dev/null 2>&1
