#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('select 1').get(); db.close();" >/dev/null 2>&1; then
  exit 0
fi

echo "[ensure-better-sqlite3] rebuilding better-sqlite3 for $(node -v)" >&2
PACKAGE_JSON_PATH="$(node -e "process.stdout.write(require.resolve('better-sqlite3/package.json'))")"
PACKAGE_DIR="$(dirname "$PACKAGE_JSON_PATH")"
cd "$PACKAGE_DIR"
"$ROOT_DIR/node_modules/.bin/node-gyp" rebuild --release
node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('select 1').get(); db.close();" >/dev/null 2>&1
