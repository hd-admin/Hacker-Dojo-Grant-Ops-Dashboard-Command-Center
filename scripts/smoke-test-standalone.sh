#!/bin/bash
# Self-contained ProPublica smoke test
# Run: bash scripts/smoke-test-standalone.sh

set -euo pipefail

log() { echo "[$(date '+%H:%M:%S')] $*"; }

cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

ROOT_DIR="/home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center"
cd "$ROOT_DIR/frontend"

PORT=5150
log "Starting server on port $PORT..."
DATA_DIR=/tmp/smoke-standalone PORT=$PORT HOSTNAME=127.0.0.1 npx next start > /tmp/smoke-server.log 2>&1 &
SERVER_PID=$!

log "Waiting for server..."
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/grants" >/dev/null 2>&1; then
    log "Server ready after ${i}s"
    break
  fi
  sleep 1
done

BASE="http://127.0.0.1:$PORT"

log "Reset..."
curl -fsS -X POST "$BASE/api/testing/reset" > /dev/null

log "Configure profile..."
curl -sS -X PUT "$BASE/api/profile" -H 'content-type: application/json' \
  -d '{"legalName":"Hacker Dojo","ein":"26-3375350","nonprofitStatus":"501(c)(3)","contactInfo":{"email":"ed@hackerdojo.com"},"mission":"Community innovation","programAreas":["STEM Education"],"searchThemes":["EdTech"],"agentBehavior":{"autoDraftThreshold":75,"submissionPolicy":"Human approval required"}}' > /dev/null 2>&1 || true

log "Configure opencode..."
OC=$(command -v opencode)
curl -fsS -X PUT "$BASE/api/opencode-settings" -H 'content-type: application/json' \
  -d "{\"binaryPath\":\"$OC\",\"isConfigured\":true,\"timeoutMs\":300000,\"workingDirectory\":\"$ROOT_DIR\"}" > /dev/null

log "Health check..."
curl -fsS "$BASE/api/health" > /dev/null

log "Verify ProPublica source..."
SOURCES=$(curl -fsS "$BASE/api/sources")
echo "$SOURCES" | node -e "const s=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); if(!s.find(x=>x.name==='ProPublica Nonprofit Explorer')){console.error('NOT FOUND');process.exit(1)}" || { log "FAIL: ProPublica not registered"; exit 1; }
log "ProPublica registered"

log "Searching ProPublica (may take 2-3 minutes)..."
PP_RESPONSE=$(curl -fsS --max-time 240 "$BASE/api/sources/propublica?query=STEM+education+nonprofit+California" 2>&1)

echo "$PP_RESPONSE" | node -e "
  const result = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (result.unavailable) { console.error('FAIL: unavailable=true'); process.exit(1); }
  if (result.error) { console.error('FAIL: ' + result.error); process.exit(1); }
  if (!Array.isArray(result.grants) || result.grants.length === 0) { console.error('FAIL: empty grants'); process.exit(1); }
  const first = result.grants[0];
  if (!first.title || !first.funder) { console.error('FAIL: missing fields'); process.exit(1); }
  console.log('SMOKE TEST PASSED: ' + result.grants.length + ' grants. First: ' + first.title + ' / ' + first.funder);
" || { log "FAIL: validation failed"; exit 1; }

log "=== SMOKE TEST PASSED ==="
