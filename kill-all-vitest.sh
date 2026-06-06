#!/bin/bash
# Kill all vitest-related processes
for pid in $(pgrep -f "pnpm.*vitest"); do
  kill -9 "$pid" 2>/dev/null
done
for pid in $(pgrep -f "node.*vitest"); do
  kill -9 "$pid" 2>/dev/null
done
for pid in $(pgrep -f "timeout.*vitest"); do
  kill -9 "$pid" 2>/dev/null
done
sleep 2
echo "remaining pnpm vitest: $(pgrep -f 'pnpm.*vitest' | wc -l)"
echo "remaining node vitest: $(pgrep -f 'node.*vitest' | wc -l)"
