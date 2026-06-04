#!/bin/bash
cd /home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center
pnpm test > /tmp/test-run.log 2>&1
echo $? > /tmp/test-run.exit
