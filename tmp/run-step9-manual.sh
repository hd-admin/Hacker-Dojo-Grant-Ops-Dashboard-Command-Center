#!/bin/bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
export FNM_DIR="$HOME/.local/share/fnm"
eval "$(fnm env --shell bash)"
fnm use 24 >/dev/null
export OPENCODE_BIN="$(command -v opencode || true)"
APP_LOG="$ROOT_DIR/tmp/step9-manual-app.log"
OUT="$ROOT_DIR/tmp/step9-manual.out"
REQ_DIR="$ROOT_DIR/tmp/step9-manual-req"
rm -rf "$REQ_DIR"
mkdir -p "$REQ_DIR"
: >"$OUT"
cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
./playwright-start.sh >"$APP_LOG" 2>&1 &
SERVER_PID=$!
READY=0
for _ in $(seq 1 90); do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
    READY=1
    break
  fi
  sleep 2
done
if [ "$READY" -ne 1 ]; then
  echo "NOT_READY" >>"$OUT"
  cat "$APP_LOG" >>"$OUT"
  exit 1
fi
if grep -E 'ENOENT|MODULE_NOT_FOUND' "$APP_LOG" >/dev/null; then
  echo "STARTUP_ERROR" >>"$OUT"
  cat "$APP_LOG" >>"$OUT"
  exit 1
fi
profile_payload="$REQ_DIR/profile.json"
settings_payload="$REQ_DIR/settings.json"
cat >"$profile_payload" <<'EOF'
{"legalName":"Hacker Dojo","ein":"26-3375350","samUEI":"XK7N4HQ2P3M9","mission":"Community innovation and education","docTypes":["PDF"],"searchThemes":["EdTech","Community"],"agentBehavior":{"autoDraftThreshold":75,"submissionPolicy":"Human approval required","notifyEmail":"ed@hackerdojo.com","voiceAndTone":"Plain-spoken"}}
EOF
node -e "const fs=require('node:fs');const p=process.argv[1];const o={binaryPath:process.argv[2],workingDirectory:process.argv[3],timeoutMs:120000,profile:'default',isConfigured:true};fs.writeFileSync(p,JSON.stringify(o));" "$settings_payload" "$ROOT_DIR/scripts/opencode-real-wrapper.sh" "$ROOT_DIR"
request() {
  local name="$1"; shift
  local method="$1"; shift
  local url="$1"; shift
  local body="$REQ_DIR/$name.body"
  local status="$REQ_DIR/$name.status"
  local headers="$REQ_DIR/$name.headers"
  curl -sS --max-time 120 -D "$headers" -o "$body" -w '%{http_code}' -X "$method" "$url" "$@" >"$status"
  printf '%s %s\n' "$name" "$(cat "$status")" >>"$OUT"
  printf '%s\n' "$(cat "$body")" >>"$OUT"
  printf '\n' >>"$OUT"
}
request reset POST http://127.0.0.1:3000/api/testing/reset
request profile PUT http://127.0.0.1:3000/api/profile -H 'content-type: application/json' --data-binary "@$profile_payload"
request settings PUT http://127.0.0.1:3000/api/opencode-settings -H 'content-type: application/json' --data-binary "@$settings_payload"
request upload POST http://127.0.0.1:3000/api/documents -F name='Hacker Dojo Program Summary' -F type=PDF -F file=@tests/fixtures/documents/hacker-dojo-program-summary.pdf
request research POST http://127.0.0.1:3000/api/research
request grants GET 'http://127.0.0.1:3000/api/grants?sortBy=fit'
GRANT_ID="$(node -e "const fs=require('node:fs');const grants=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const grant=grants.find(g=>g.status==='matched'&&!g.draftContent);if(!grant){process.exit(1);}process.stdout.write(grant.id);" "$REQ_DIR/grants.body")"
request draft POST "http://127.0.0.1:3000/api/grants/$GRANT_ID/draft"
if grep -q 'E2E stub' "$REQ_DIR/draft.body"; then
  echo "STUB_TEXT_PRESENT" >>"$OUT"
  exit 1
fi
echo "SUCCESS" >>"$OUT"
