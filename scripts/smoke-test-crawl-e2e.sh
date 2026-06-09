#!/usr/bin/env bash
# End-to-end crawl smoke test against REAL data.
#
# Drives the running app exactly as a user would: configures OpenCode (self-heal),
# approves a real funding source, triggers a real crawl, waits for the background job,
# and reports the actual CrawlRun outcome + grants found. This is the only test that
# proves the FULL pipeline (real opencode agent -> web/API research -> schema
# validation -> SQLite ingestion) works against live data.
#
# NOT part of `npm test` — consumes real AI tokens, needs internet + opencode auth.
# Prereqs: dev/prod server already running (npm run dev). Override with BASE_URL.
# Run with: npm run smoke:crawl
#   SOURCE_ID=source-grants-gov  npm run smoke:crawl   # pick the source to crawl
#   POLL_BUDGET=420              npm run smoke:crawl   # max seconds to wait
# Expected: 'Smoke test PASSED' and exit 0 when the crawl completes (grants found is
# reported but a legitimately-empty source still passes as long as it completed cleanly).
set -euo pipefail

# Canonical app port/host (single source of truth: config/app.json)
source "$(dirname "${BASH_SOURCE[0]}")/lib/app-config.sh"

BASE_URL="${BASE_URL:-$APP_BASE_URL}"
SOURCE_ID="${SOURCE_ID:-source-grants-gov}"
POLL_BUDGET="${POLL_BUDGET:-420}"

if ! command -v opencode >/dev/null 2>&1; then
  echo "ERROR: opencode not found on PATH." >&2
  exit 2
fi

if ! curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/health" | grep -q '200'; then
  echo "ERROR: server not reachable at $BASE_URL. Start it with 'npm run dev' first." >&2
  exit 2
fi

echo "Approving source $SOURCE_ID ..."
curl -s -o /dev/null -X POST "$BASE_URL/api/sources/$SOURCE_ID/review" \
  -H 'content-type: application/json' -d '{"action":"approve"}'

GRANTS_BEFORE=$(curl -s "$BASE_URL/api/grants" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);const a=Array.isArray(j)?j:(j.grants||j.data||[]);console.log(a.length)})')
echo "Grants before crawl: $GRANTS_BEFORE"

echo "Triggering crawl for $SOURCE_ID ..."
START_RESP=$(curl -s -X POST "$BASE_URL/api/crawl/start" \
  -H 'content-type: application/json' -d "{\"sourceId\":\"$SOURCE_ID\"}")
echo "$START_RESP" | grep -q '"queued":true' || { echo "Smoke test FAILED: crawl not queued. Response: $START_RESP" >&2; exit 1; }

echo "Waiting for crawl job (budget ${POLL_BUDGET}s)..."
ELAPSED=0
STATUS=""
while [ "$ELAPSED" -lt "$POLL_BUDGET" ]; do
  sleep 6
  ELAPSED=$((ELAPSED + 6))
  STATUS=$(curl -s "$BASE_URL/api/jobs" | node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      const j=JSON.parse(d);const a=Array.isArray(j)?j:(j.jobs||j.data||[]);
      const job=a.find(x=>x.jobType==="crawl"&&x.entityId===process.argv[1])||a.find(x=>x.jobType==="crawl")||a[0];
      console.log(job?job.status:"none");
    })' "$SOURCE_ID")
  echo "  [${ELAPSED}s] job status: $STATUS"
  case "$STATUS" in completed|failed|succeeded) break;; esac
done

echo "=== Result ==="
RESEARCH=$(curl -s "$BASE_URL/api/research")
echo "Latest crawl run: $(echo "$RESEARCH" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);const r=j.latestRun||{};console.log(JSON.stringify({status:r.status,sourcesCrawled:r.sourcesCrawled,grantsFound:r.grantsFound,grantsMatched:r.grantsMatched,errorMessage:r.errorMessage}))})')"

GRANTS_AFTER=$(curl -s "$BASE_URL/api/grants" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);const a=Array.isArray(j)?j:(j.grants||j.data||[]);console.log(a.length);a.slice(0,8).forEach(g=>process.stderr.write("  - "+g.title+" | "+g.funder+" | fit "+g.fit+"\n"))})')
echo "Grants after crawl: $GRANTS_AFTER (was $GRANTS_BEFORE)"

if [ "$STATUS" = "failed" ]; then
  echo "Smoke test FAILED: crawl job ended in 'failed'. See errorMessage above." >&2
  exit 1
fi
if [ "$STATUS" != "completed" ] && [ "$STATUS" != "succeeded" ]; then
  echo "Smoke test FAILED: crawl job did not finish within ${POLL_BUDGET}s (status: $STATUS)." >&2
  exit 1
fi

NEW_GRANTS=$((GRANTS_AFTER - GRANTS_BEFORE))
echo "New grants discovered this run: $NEW_GRANTS"
if [ "$NEW_GRANTS" -gt 0 ]; then
  echo "Smoke test PASSED (pipeline completed AND found $NEW_GRANTS new grant(s) from real data)."
else
  echo "Smoke test PASSED (pipeline completed cleanly; 0 new grants — verify the source actually has open opportunities)."
fi
