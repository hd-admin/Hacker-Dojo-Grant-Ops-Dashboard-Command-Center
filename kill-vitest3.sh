#!/bin/bash
for pid in $(pgrep -f "pnpm.*vitest"); do
  kill -9 "$pid" 2>/dev/null
done
for pid in $(pgrep -f "node.*vitest"); do
  kill -9 "$pid" 2>/dev/null
done
sleep 2
echo $(pgrep -f "pnpm.*vitest" | wc -l)
