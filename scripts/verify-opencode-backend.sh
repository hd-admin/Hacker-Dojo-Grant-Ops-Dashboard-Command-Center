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
export OPENCODE_PURE=1
PROOF_BINARY_PATH="$ROOT_DIR/scripts/opencode-real-wrapper.sh"

APP_LOG="${TMPDIR:-/tmp}/grant-ops-opencode-proof.log"
REQUEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/grant-ops-opencode-proof.XXXXXX")"
export DATA_DIR="$REQUEST_DIR/data"
PID_FILE="$DATA_DIR/playwright-start.pid"
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

# Kill any process already occupying port 3000 before starting
kill_port_3000
sleep 1

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  kill_port_3000
  rm -rf "$REQUEST_DIR"
}
trap cleanup EXIT

./playwright-start.sh >"$APP_LOG" 2>&1 &
SERVER_LAUNCH_PID=$!
SERVER_PID="$SERVER_LAUNCH_PID"

READY=0
for _ in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:3000/api/grants >/dev/null; then
    READY=1
    break
  fi
  sleep 3
done
if [ "$READY" -ne 1 ]; then
  echo "Server did not become ready" >&2
  cat "$APP_LOG" >&2
  exit 1
fi
SERVER_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [ -z "$SERVER_PID" ]; then
  SERVER_PID="$SERVER_LAUNCH_PID"
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

pre_runs_body="$REQUEST_DIR/pre-runs.body"
pre_runs_status="$REQUEST_DIR/pre-runs.status"
request GET http://127.0.0.1:3000/api/research "$pre_runs_body" "$pre_runs_status"

pre_grants_body="$REQUEST_DIR/pre-grants.body"
pre_grants_status="$REQUEST_DIR/pre-grants.status"
request GET 'http://127.0.0.1:3000/api/grants?sortBy=fit' "$pre_grants_body" "$pre_grants_status"

pre_sources_body="$REQUEST_DIR/pre-sources.body"
pre_sources_status="$REQUEST_DIR/pre-sources.status"
request GET http://127.0.0.1:3000/api/sources "$pre_sources_body" "$pre_sources_status"

research_body="$REQUEST_DIR/research.body"
research_status="$REQUEST_DIR/research.status"
request POST http://127.0.0.1:3000/api/research "$research_body" "$research_status"

post_runs_body="$REQUEST_DIR/post-runs.body"
post_runs_status="$REQUEST_DIR/post-runs.status"
request GET http://127.0.0.1:3000/api/research "$post_runs_body" "$post_runs_status"

post_grants_body="$REQUEST_DIR/post-grants.body"
post_grants_status="$REQUEST_DIR/post-grants.status"
request GET 'http://127.0.0.1:3000/api/grants?sortBy=fit' "$post_grants_body" "$post_grants_status"

post_sources_body="$REQUEST_DIR/post-sources.body"
post_sources_status="$REQUEST_DIR/post-sources.status"
request GET http://127.0.0.1:3000/api/sources "$post_sources_body" "$post_sources_status"

GRANT_ID="$(node - "$pre_runs_body" "$post_runs_body" "$pre_grants_body" "$post_grants_body" "$pre_sources_body" "$post_sources_body" "$research_body" <<'NODE'
const fs = require('node:fs');
const [preRunsPath, postRunsPath, preGrantsPath, postGrantsPath, preSourcesPath, postSourcesPath, researchPath] = process.argv.slice(2);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const preRuns = readJson(preRunsPath);
const postRuns = readJson(postRunsPath);
const preGrants = readJson(preGrantsPath);
const postGrants = readJson(postGrantsPath);
const preSources = readJson(preSourcesPath);
const postSources = readJson(postSourcesPath);
const researchResponse = readJson(researchPath);

const sentinelStrings = ['real-opencode-001', 'Real Opencode Community Grant', '"funder":"Real Opencode"'];
const assertNoSentinels = (value, label) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const sentinel of sentinelStrings) {
    if (text.includes(sentinel)) {
      throw new Error(`${label} payload contains sentinel value ${sentinel}`);
    }
  }
};
if (researchResponse.success !== true) {
  throw new Error('POST /api/research summary did not report success');
}
if (!researchResponse.crawlRun || researchResponse.crawlRun.status !== 'completed') {
  throw new Error('POST /api/research summary did not include a completed crawlRun');
}
if (!researchResponse.crawlRun.completedAt) {
  throw new Error('POST /api/research summary crawlRun is missing completedAt');
}
if (typeof researchResponse.sourcesCrawled !== 'number' || researchResponse.sourcesCrawled < 1) {
  throw new Error('POST /api/research summary did not report sourcesCrawled');
}

assertNoSentinels(postGrants, 'grants');

if (!Array.isArray(preRuns.allRuns) || !Array.isArray(postRuns.allRuns)) {
  throw new Error('Research payload did not include allRuns arrays');
}
if (postRuns.allRuns.length !== preRuns.allRuns.length + 1) {
  throw new Error(`Expected exactly one new crawl run, found ${preRuns.allRuns.length} -> ${postRuns.allRuns.length}`);
}
if (!postRuns.latestRun || postRuns.latestRun.id === preRuns.latestRun?.id) {
  throw new Error('Latest crawl run did not change after research');
}
if (postRuns.latestRun.status !== 'completed') {
  throw new Error(`Latest crawl run status was ${postRuns.latestRun.status}`);
}
if (!postRuns.latestRun.completedAt) {
  throw new Error('Latest crawl run missing completedAt');
}

if (!Array.isArray(preSources) || !Array.isArray(postSources)) {
  throw new Error('Sources payload did not return arrays');
}
if (postSources.length < preSources.length + 1) {
  throw new Error(`Expected at least one new source, found ${preSources.length} -> ${postSources.length}`);
}
if (!postSources.some((source) => Boolean(source.lastCrawledAt))) {
  throw new Error('No post-research source had lastCrawledAt set');
}

const preGrantById = new Map(preGrants.map((grant) => [grant.id, grant]));
const deltaGrant = postGrants.find((grant) => {
  if (grant.status !== 'matched' || grant.draftContent) {
    return false;
  }
  const before = preGrantById.get(grant.id);
  if (!before) {
    return true;
  }
  return (grant.sourceCount ?? 0) > (before.sourceCount ?? 0);
});
if (!deltaGrant) {
  throw new Error('No draftable grant attributable to the research delta was found');
}

process.stdout.write(deltaGrant.id);
NODE
)"

draft_body="$REQUEST_DIR/draft.body"
draft_status="$REQUEST_DIR/draft.status"
request POST "http://127.0.0.1:3000/api/grants/$GRANT_ID/draft" "$draft_body" "$draft_status"

echo "--- Step 9 proof ---"
echo "POST /api/testing/reset -> $(cat "$reset_status")"
echo "PUT /api/profile -> $(cat "$profile_status")"
echo "PUT /api/opencode-settings -> $(cat "$settings_status")"
echo "POST /api/documents -> $(cat "$upload_status")"
echo "GET /api/research (pre/post) -> $(cat "$pre_runs_status") / $(cat "$post_runs_status")"
echo "GET /api/grants?sortBy=fit (pre/post) -> $(cat "$pre_grants_status") / $(cat "$post_grants_status")"
echo "GET /api/sources (pre/post) -> $(cat "$pre_sources_status") / $(cat "$post_sources_status")"
echo "POST /api/research -> $(cat "$research_status")"
echo "POST /api/grants/$GRANT_ID/draft -> $(cat "$draft_status")"

draft_text="$(cat "$draft_body")"
if printf '%s' "$draft_text" | grep -q 'E2E stub'; then
  echo "Draft contains E2E stub text" >&2
  exit 1
fi

for status_file in \
  "$reset_status" "$profile_status" "$settings_status" "$upload_status" \
  "$pre_runs_status" "$pre_grants_status" "$pre_sources_status" \
  "$research_status" "$post_runs_status" "$post_grants_status" "$post_sources_status" \
  "$draft_status"; do
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
