#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DATA_DIR="$SCRIPT_DIR/.grant-ops-data"
cd "$SCRIPT_DIR/frontend"
"$SCRIPT_DIR/node_modules/.bin/next" dev -p 3000
