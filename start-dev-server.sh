#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/frontend" && "$SCRIPT_DIR/node_modules/.bin/next" dev -p 3000
