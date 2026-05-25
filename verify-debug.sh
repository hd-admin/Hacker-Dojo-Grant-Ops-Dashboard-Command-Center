#!/bin/bash
set -euo pipefail

ROOT_DIR="/Users/mistlight/Projects/Experiments/HackerDojoGrantApp"
cd "$ROOT_DIR"

lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

export PATH="/opt/homebrew/bin:$PATH"
export DATA_DIR="$ROOT_DIR/.grant-ops-data"

./playwright-start.sh > /tmp/verify-test.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

READY=0
for i in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:3000/ > /dev/null 2>&1; then
    echo "Server ready after ${i}s"
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "Server did not become ready"
  cat /tmp/verify-test.log
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi

echo "=== Testing reset ==="
RESET_RESP=$(curl -sS -X POST http://127.0.0.1:3000/api/testing/reset -w "\n%{http_code}")
echo "$RESET_RESP"

echo "=== Testing opencode-settings GET (should be seeded defaults) ==="
SETTINGS_GET=$(curl -sS -X GET http://127.0.0.1:3000/api/opencode-settings -w "\n%{http_code}")
echo "$SETTINGS_GET"

echo "=== Testing opencode-settings PUT ==="
PROOF_BINARY_PATH="$ROOT_DIR/scripts/opencode-real-wrapper.sh"
SETTINGS_PUT=$(curl -sS -X PUT http://127.0.0.1:3000/api/opencode-settings \
  -H "Content-Type: application/json" \
  -d "$(node -e "const fs=require('node:fs');const o={binaryPath:process.argv[1],workingDirectory:process.argv[2],timeoutMs:120000,profile:'default',isConfigured:true};fs.writeFileSync('/dev/stdout',JSON.stringify(o));" "$PROOF_BINARY_PATH" "$ROOT_DIR")" \
  -w "\n%{http_code}")
echo "$SETTINGS_PUT"

echo "=== Testing opencode-settings GET after PUT ==="
SETTINGS_GET2=$(curl -sS -X GET http://127.0.0.1:3000/api/opencode-settings -w "\n%{http_code}")
echo "$SETTINGS_GET2"

echo "=== Testing research POST ==="
RESEARCH_RESP=$(curl -sS -X POST http://127.0.0.1:3000/api/research -w "\n%{http_code}")
echo "$RESEARCH_RESP"

echo "=== App log tail ==="
tail -n 30 /tmp/verify-test.log

kill $SERVER_PID 2>/dev/null || true
echo "Done"