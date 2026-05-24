#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! node -e "const Database=require('better-sqlite3');const db=new Database(':memory:');db.prepare('select 1').get();db.close();"; then
  bash "$ROOT_DIR/scripts/ensure-better-sqlite3.sh"
  node -e "const Database=require('better-sqlite3');const db=new Database(':memory:');db.prepare('select 1').get();db.close();"
fi

export OPENCODE_BIN="$(command -v opencode || true)"
if [ -z "$OPENCODE_BIN" ]; then
  echo "opencode executable not found on PATH" >&2
  exit 2
fi
PROOF_BINARY_PATH="$ROOT_DIR/scripts/opencode-real-wrapper.sh"

APP_LOG="${TMPDIR:-/tmp}/grant-ops-opencode-proof.log"
REQUEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/grant-ops-opencode-proof.XXXXXX")"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$REQUEST_DIR"
}
trap cleanup EXIT

./playwright-start.sh >"$APP_LOG" 2>&1 &
SERVER_PID=$!

READY=0
for _ in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:3000/ >/dev/null; then
    READY=1
    break
  fi
  sleep 2
done
if [ "$READY" -ne 1 ]; then
  echo "Server did not become ready" >&2
  cat "$APP_LOG" >&2
  exit 1
fi

if grep -E 'ENOENT|MODULE_NOT_FOUND' "$APP_LOG" >/dev/null; then
  echo "Startup log contains ENOENT or MODULE_NOT_FOUND" >&2
  cat "$APP_LOG" >&2
  exit 1
fi

request() {
  local method="$1"
  local url="$2"
  local body_file="$3"
  local status_file="$4"
  shift 4
  curl -sS -o "$body_file" -w '%{http_code}' -X "$method" "$url" "$@" >"$status_file"
}

profile_payload="$REQUEST_DIR/profile.json"
settings_payload="$REQUEST_DIR/opencode-settings.json"
document_path="tests/fixtures/documents/hacker-dojo-program-summary.pdf"

cat >"$profile_payload" <<'EOF'
{"legalName":"Hacker Dojo","ein":"26-3375350","samUEI":"XK7N4HQ2P3M9","mission":"Community innovation and education","docTypes":["PDF"],"searchThemes":["EdTech","Community"],"agentBehavior":{"autoDraftThreshold":75,"submissionPolicy":"Human approval required","notifyEmail":"ed@hackerdojo.com","voiceAndTone":"Plain-spoken"}}
EOF

node -e "const fs=require('node:fs');const p=process.argv[1];const o={binaryPath:process.argv[2],workingDirectory:process.argv[3],timeoutMs:120000,profile:'default',isConfigured:true};fs.writeFileSync(p,JSON.stringify(o));" "$settings_payload" "$PROOF_BINARY_PATH" "$ROOT_DIR"

reset_body="$REQUEST_DIR/reset.body"
reset_status="$REQUEST_DIR/reset.status"
request POST http://127.0.0.1:3000/api/testing/reset "$reset_body" "$reset_status"

profile_body="$REQUEST_DIR/profile.body"
profile_status="$REQUEST_DIR/profile.status"
request PUT http://127.0.0.1:3000/api/profile "$profile_body" "$profile_status" -H 'content-type: application/json' --data-binary "@$profile_payload"

settings_body="$REQUEST_DIR/settings.body"
settings_status="$REQUEST_DIR/settings.status"
request PUT http://127.0.0.1:3000/api/opencode-settings "$settings_body" "$settings_status" -H 'content-type: application/json' --data-binary "@$settings_payload"

upload_body="$REQUEST_DIR/upload.body"
upload_status="$REQUEST_DIR/upload.status"
request POST http://127.0.0.1:3000/api/documents "$upload_body" "$upload_status" -F name='Hacker Dojo Program Summary' -F type=PDF -F file=@"$document_path"

research_body="$REQUEST_DIR/research.body"
research_status="$REQUEST_DIR/research.status"
request POST http://127.0.0.1:3000/api/research "$research_body" "$research_status"

grants_body="$REQUEST_DIR/grants.body"
grants_status="$REQUEST_DIR/grants.status"
request GET 'http://127.0.0.1:3000/api/grants?sortBy=fit' "$grants_body" "$grants_status"

GRANT_ID="$(node -e "const fs=require('node:fs');const grants=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const grant=grants.find(g=>g.status==='matched'&&!g.draftContent);if(!grant){process.exit(1);}process.stdout.write(grant.id);" "$grants_body")"

draft_body="$REQUEST_DIR/draft.body"
draft_status="$REQUEST_DIR/draft.status"
request POST "http://127.0.0.1:3000/api/grants/$GRANT_ID/draft" "$draft_body" "$draft_status"

echo "--- Step 9 proof ---"
echo "POST /api/testing/reset -> $(cat "$reset_status")"
cat "$reset_body"
echo

echo "PUT /api/profile -> $(cat "$profile_status")"
cat "$profile_body"
echo

echo "PUT /api/opencode-settings -> $(cat "$settings_status")"
cat "$settings_body"
echo

echo "POST /api/documents -> $(cat "$upload_status")"
cat "$upload_body"
echo

echo "POST /api/research -> $(cat "$research_status")"
cat "$research_body"
echo

echo "GET /api/grants?sortBy=fit -> $(cat "$grants_status")"
cat "$grants_body"
echo

echo "POST /api/grants/$GRANT_ID/draft -> $(cat "$draft_status")"
cat "$draft_body"
echo

draft_text="$(cat "$draft_body")"
if printf '%s' "$draft_text" | grep -q 'E2E stub'; then
  echo "Draft contains E2E stub text" >&2
  exit 1
fi

for status_file in "$reset_status" "$profile_status" "$settings_status" "$upload_status" "$research_status" "$grants_status" "$draft_status"; do
  case "$(cat "$status_file")" in
    2??)
      ;;
    *)
      echo "Non-2xx status detected in $(basename "$status_file")" >&2
      exit 1
      ;;
  esac
done

echo "Step 9 real backend proof passed"
