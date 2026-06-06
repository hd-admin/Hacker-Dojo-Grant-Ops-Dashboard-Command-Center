#!/bin/bash
for pid in $(pgrep -f "vitest run"); do
  kill -9 "$pid" 2>/dev/null
done
sleep 2
echo $(pgrep -f "vitest run" | wc -l)
