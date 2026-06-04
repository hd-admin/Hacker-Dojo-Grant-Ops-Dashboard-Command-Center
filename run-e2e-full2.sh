#!/bin/bash
cd /home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center
pnpm exec playwright test > /tmp/e2e-full2.log 2>&1
echo $? > /tmp/e2e-full2.exit
