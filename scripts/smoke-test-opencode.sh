#!/usr/bin/env bash
# Smoke test for the OpenCode CLI invocation contract.
#
# This is the ONLY test that exercises the REAL `opencode` binary the way the crawl
# pipeline does. The automated vitest suite uses a fake adapter, so it cannot catch
# invocation regressions (e.g. the headless permission-prompt hang). This script runs
# the exact command the app runs and asserts that:
#   1. it returns headlessly within a time budget (does NOT hang), and
#   2. it emits a JSON event stream we can parse back into text.
#
# NOT part of `npm test` — it consumes real AI tokens and needs opencode authenticated.
# Run with: npm run smoke:opencode
# Expected: 'Smoke test PASSED' and exit code 0.
set -euo pipefail

BUDGET_SECONDS="${OPENCODE_SMOKE_BUDGET:-120}"
MODEL_FLAG=""
if [ -n "${OPENCODE_SMOKE_MODEL:-}" ]; then
  MODEL_FLAG="-m ${OPENCODE_SMOKE_MODEL}"
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "ERROR: opencode not found on PATH. Install opencode before running this smoke test." >&2
  exit 2
fi

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/smoke-opencode.XXXXXX")"
OUT_FILE="$WORK_DIR/out.txt"
ERR_FILE="$WORK_DIR/err.txt"
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

PROMPT='Return only JSON. Reply with exactly {"grants":[],"evidence":[],"rationale":"smoke-test"} and nothing else.'

echo "Running opencode (budget ${BUDGET_SECONDS}s)..."
START=$(date +%s)

# Exactly mirrors CliOpencodeProvider.runCommand: `run --dangerously-skip-permissions
# --format json <prompt>`, stdin ignored. macOS has no `timeout`, so guard manually.
( opencode run --dangerously-skip-permissions --format json $MODEL_FLAG "$PROMPT" \
    >"$OUT_FILE" 2>"$ERR_FILE" </dev/null ) &
RUN_PID=$!
( sleep "$BUDGET_SECONDS" && kill -9 "$RUN_PID" 2>/dev/null ) &
WATCH_PID=$!
set +e
wait "$RUN_PID" 2>/dev/null
EXIT_CODE=$?
set -e
kill "$WATCH_PID" 2>/dev/null || true
END=$(date +%s)
ELAPSED=$((END - START))

echo "opencode exited code=${EXIT_CODE} in ${ELAPSED}s"

if [ "$EXIT_CODE" -eq 137 ] || [ "$ELAPSED" -ge "$BUDGET_SECONDS" ]; then
  echo "Smoke test FAILED: opencode hung past the ${BUDGET_SECONDS}s budget (the headless-permission-prompt regression)." >&2
  echo "--- stderr (tail) ---" >&2
  tail -20 "$ERR_FILE" >&2 || true
  exit 1
fi

if [ "$EXIT_CODE" -ne 0 ]; then
  echo "Smoke test FAILED: opencode exited non-zero (${EXIT_CODE})." >&2
  echo "--- stderr (tail) ---" >&2
  tail -20 "$ERR_FILE" >&2 || true
  exit 1
fi

# Validate the output is a parseable JSON event stream that reduces to model text,
# mirroring normalizeOpencodeOutput.
node -e '
const fs = require("fs");
const raw = fs.readFileSync(process.argv[1], "utf8").trim();
if (!raw) { console.error("Smoke test FAILED: empty stdout."); process.exit(1); }
const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
let parsedAny = false;
let text = "";
for (const line of lines) {
  let ev;
  try { ev = JSON.parse(line); } catch { continue; }
  parsedAny = true;
  if (ev && ev.type === "text" && ev.part && typeof ev.part.text === "string") {
    text += ev.part.text;
  }
}
if (!parsedAny) {
  // Some opencode builds may emit a single bare JSON object instead of an event stream.
  try { JSON.parse(raw); parsedAny = true; text = raw; } catch {}
}
if (!parsedAny) { console.error("Smoke test FAILED: stdout was not parseable JSON."); process.exit(1); }
console.log("Reduced model text:", text.slice(0, 200) || "(no text events)");
' "$OUT_FILE"

echo "Smoke test PASSED"
