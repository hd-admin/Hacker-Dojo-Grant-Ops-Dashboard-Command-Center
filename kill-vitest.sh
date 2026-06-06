#!/bin/bash
pkill -9 -f "vitest run"
sleep 2
ps aux | grep "vitest run" | grep -v grep | wc -l
