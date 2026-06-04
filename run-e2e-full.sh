#!/bin/bash
cd /home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center
pnpm exec playwright test > /tmp/e2e-full.log 2>&1
echo $? > /tmp/e2e-full.exit
