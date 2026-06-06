#!/bin/bash
# Run the full vitest suite in sequential batches to avoid the shared DB state
# exhaustion / process memory growth that kills the full `pnpm vitest run`.
# Uses the project vitest.config.ts exactly (no pool overrides).
# Failed batches are retried up to MAX_RETRIES times to tolerate transient
# environmental memory-pressure kills (OOM) observed on shared runners.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG="$REPO_ROOT/test-batches.log"
BATCH_SIZE=8
MAX_RETRIES=2

# Generate the test list if missing or stale
cd "$REPO_ROOT"
find tests frontend/src shared -name '*.test.ts' -o -name '*.test.tsx' | sort > /tmp/all-tests.txt

TOTAL=$(wc -l < /tmp/all-tests.txt)
BATCH=0
FAILED_BATCHES=()

> "$LOG"

while read -r -a files; do
  if [ ${#files[@]} -eq 0 ]; then break; fi
  BATCH=$((BATCH + 1))
  ATTEMPT=0
  BATCH_PASSED=0

  while [ $ATTEMPT -le $MAX_RETRIES ] && [ $BATCH_PASSED -eq 0 ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo "=== BATCH $BATCH (attempt $ATTEMPT) ===" >> "$LOG"
    cd "$REPO_ROOT"
    if ./node_modules/.bin/vitest run "${files[@]}" --reporter=basic --no-color >> "$LOG" 2>&1; then
      echo "BATCH $BATCH PASSED (attempt $ATTEMPT)" >> "$LOG"
      BATCH_PASSED=1
    else
      echo "BATCH $BATCH FAILED (attempt $ATTEMPT)" >> "$LOG"
      if [ $ATTEMPT -le $MAX_RETRIES ]; then
        # Brief pause to let memory pressure settle before retry
        sleep 2
      fi
    fi
    echo "" >> "$LOG"
  done

  if [ $BATCH_PASSED -eq 0 ]; then
    FAILED_BATCHES+=("$BATCH")
  fi
done < <(awk -v n="$BATCH_SIZE" '{for(i=1;i<=NF;i++) printf "%s ", $i; if(NR%n==0) print ""}' /tmp/all-tests.txt)

FAILED_COUNT=${#FAILED_BATCHES[@]}
echo "=== ALL BATCHES COMPLETE ($TOTAL files, $FAILED_COUNT failed batches) ===" >> "$LOG"

if [ "$FAILED_COUNT" -ne 0 ]; then
  echo "Failed batches: ${FAILED_BATCHES[*]}" >> "$LOG"
  echo "ERROR: $FAILED_COUNT batch(es) failed after $MAX_RETRIES retries. See $LOG for details." >&2
  exit 1
fi
