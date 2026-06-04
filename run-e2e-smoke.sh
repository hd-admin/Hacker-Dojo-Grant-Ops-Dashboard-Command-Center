#!/bin/bash
cd /home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center
pnpm exec playwright test tests/e2e/health-bootstrap.spec.ts > /tmp/e2e-smoke.log 2>&1
echo $? > /tmp/e2e-smoke.exit
