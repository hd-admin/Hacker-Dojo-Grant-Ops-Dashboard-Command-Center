#!/bin/bash
set -e
LOG=/home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center/test-batches.log
> "$LOG"

TOTAL=$(wc -l < /tmp/all-tests.txt)
BATCH_SIZE=20
BATCH=0

while read -r -a files; do
  if [ ${#files[@]} -eq 0 ]; then break; fi
  BATCH=$((BATCH + 1))
  echo "=== BATCH $BATCH ===" >> "$LOG"
  cd /home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center
  if pnpm vitest run "${files[@]}" --reporter=verbose >> "$LOG" 2>&1; then
    echo "BATCH $BATCH PASSED" >> "$LOG"
  else
    echo "BATCH $BATCH FAILED" >> "$LOG"
  fi
  echo "" >> "$LOG"
done < <(awk -v n="$BATCH_SIZE" '{for(i=1;i<=NF;i++) printf "%s ", $i; if(NR%n==0) print ""}' /tmp/all-tests.txt)

echo "=== ALL BATCHES COMPLETE ===" >> "$LOG"
