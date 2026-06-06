#!/bin/bash
cd /home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center
pnpm build > /tmp/build.log 2>&1
echo "BUILD_EXIT_CODE=$?" >> /tmp/build.log
