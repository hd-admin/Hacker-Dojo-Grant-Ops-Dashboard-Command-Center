#!/usr/bin/env bash
# Smoke test for ProPublica e2e AI backend operations.
# NOT part of the automated test suite - consumes real AI tokens and requires internet.
# Prerequisites:
#   - opencode binary accessible on PATH
#   - Valid AI API key configured for opencode
#   - Internet access to ProPublica API
# Run with: pnpm smoke:propublica
# Expected output: 'Smoke test PASSED' with exit code 0
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." ; pwd)"
cd "$ROOT_DIR"

if ! command -v opencode >/dev/null 2>&1; then
  echo "ERROR: opencode not found on PATH. Install opencode before running this smoke test." >&2
  exit 2
fi

REQUEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/smoke-propublica.XXXXXX")"
export DATA_DIR="$REQUEST_DIR/data"
APP_LOG="$REQUEST_DIR/app.log"
SERVER_PID=""

kill_port_3000() {
  local port_pids
  port_pids="$(lsof -t -iTCP:3000 -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$port_pids" ]; then
    kill $port_pids 2>/dev/null || true
    sleep 1
    port_pids="$(lsof -t -iTCP:3000 -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$port_pids" ]; then
      kill -9 $port_pids 2>/dev/null || true
    fi
  fi
}

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  pkill -f "playwright-start.sh" 2>/dev/null || true
  pkill -9 -f "next-server" 2>/dev/null || true
  pkill -9 -f "next start" 2>/dev/null || true
  kill_port_3000
  rm -rf "$REQUEST_DIR"
}
trap cleanup EXIT

kill_port_3000
sleep 1

./playwright-start.sh >"$APP_LOG" 2>&1 &
SERVER_PID=$!

echo "Waiting for server on port 3000..."
READY=0
for _ in $(seq 1 90); do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/api/grants >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "ERROR: Server did not become ready within 90 seconds." >&2
  cat "$APP_LOG" >&2
  exit 1
fi

echo "Server ready."

# POST /api/testing/reset
curl -fsS -X POST http://127.0.0.1:3000/api/testing/reset >/dev/null

# PUT /api/profile
curl -fsS -X PUT http://127.0.0.1:3000/api/profile \
  -H 'content-type: application/json' \
  -d '{"legalName":"Hacker Dojo","ein":"26-3375350","samUEI":"XK7N4HQ2P3M9","mission":"Community innovation and education in Silicon Valley","docTypes":["PDF"],"searchThemes":["EdTech","Community Innovation"],"agentBehavior":{"autoDraftThreshold":75,"submissionPolicy":"Human approval required","notifyEmail":"ed@hackerdojo.com","voiceAndTone":"Plain-spoken"}}' \
  >/dev/null

# PUT /api/opencode-settings
OPENCODE_PATH="$(command -v opencode)"
curl -fsS -X PUT http://127.0.0.1:3000/api/opencode-settings \
  -H 'content-type: application/json' \
  -d "{\"binaryPath\":\"${OPENCODE_PATH}\",\"isConfigured\":true,\"timeoutMs\":120000,\"workingDirectory\":\"${ROOT_DIR}\"}" \
  >/dev/null

# GET /api/health (triggers ProPublica source registration)
echo "Calling /api/health to trigger ProPublica source registration..."
curl -fsS http://127.0.0.1:3000/api/health >/dev/null

# GET /api/sources - verify ProPublica is present
echo "Verifying ProPublica source is registered..."
SOURCES_RESPONSE="$(curl -fsS http://127.0.0.1:3000/api/sources)"
node -e "
const sources = JSON.parse(process.argv[1]);
const pp = sources.find(s => s.name === 'ProPublica Nonprofit Explorer');
if (!pp) {
  console.error('ERROR: ProPublica Nonprofit Explorer source not found in /api/sources');
  process.exit(1);
}
console.log('ProPublica source registered: ' + pp.name + ' (' + pp.url + ')');
" "$SOURCES_RESPONSE"

# GET /api/sources/propublica?query=... with real AI call
echo "Searching ProPublica for STEM education grants (this may take up to 2 minutes)..."
PP_RESPONSE="$(curl -fsS --max-time 120 "http://127.0.0.1:3000/api/sources/propublica?query=STEM+education+nonprofit+California")"

# Validate response
node -e "
const result = JSON.parse(process.argv[1]);
if (result.unavailable) {
  console.error('ERROR: ProPublica search returned unavailable=true');
  process.exit(1);
}
if (result.error) {
  console.error('ERROR: ProPublica search returned error: ' + result.error);
  process.exit(1);
}
if (!Array.isArray(result.grants) || result.grants.length === 0) {
  console.error('ERROR: ProPublica search returned empty grants array');
  process.exit(1);
}
const first = result.grants[0];
if (!first.title || !first.funder) {
  console.error('ERROR: First grant is missing title or funder');
  process.exit(1);
}
console.log('PASS: ProPublica returned ' + result.grants.length + ' grants. First: ' + first.title + ' / ' + first.funder);
" "$PP_RESPONSE"

echo "Smoke test PASSED"
