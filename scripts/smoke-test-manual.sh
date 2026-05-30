#!/bin/bash
set -euo pipefail
BASE="http://127.0.0.1:3099"
echo "=== ProPublica Smoke Test ==="
echo "Step 1: Reset"
curl -fsS -X POST "$BASE/api/testing/reset" > /dev/null && echo "OK"
echo "Step 2: Configure profile"
curl -fsS -X PUT "$BASE/api/profile" -H 'content-type: application/json' -d '{"legalName":"Hacker Dojo","ein":"26-3375350","samUEI":"XK7N4HQ2P3M9","nonprofitStatus":"501(c)(3)","contactInfo":{"email":"ed@hackerdojo.com","website":"https://hackerdojo.com"},"geography":"Silicon Valley, CA","mission":"Community innovation and education in Silicon Valley","programAreas":["STEM Education","Community Innovation"],"populationsServed":["adults","youth"],"fundingHistory":[],"partnerships":[],"complianceFacts":[],"docTypes":["PDF"],"searchThemes":["EdTech","Community Innovation"],"agentBehavior":{"autoDraftThreshold":75,"submissionPolicy":"Human approval required","notifyEmail":"ed@hackerdojo.com","voiceAndTone":"Plain-spoken"}}' > /dev/null && echo "OK"
echo "Step 3: Configure opencode"
OC=$(command -v opencode)
curl -fsS -X PUT "$BASE/api/opencode-settings" -H 'content-type: application/json' -d "{\"binaryPath\":\"$OC\",\"isConfigured\":true,\"timeoutMs\":300000,\"workingDirectory\":\"/home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center\"}" > /dev/null && echo "OK"
echo "Step 4: Health check"
curl -fsS "$BASE/api/health" > /dev/null && echo "OK"
echo "Step 5: Verify ProPublica source"
SOURCES=$(curl -fsS "$BASE/api/sources")
echo "$SOURCES" | node -e "const s=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); if(!s.find(x=>x.name==='ProPublica Nonprofit Explorer')){console.error('NOT FOUND');process.exit(1)} console.log('OK')"
echo "Step 6: ProPublica AI search (may take 3+ minutes)"
PP_RESPONSE=$(curl -fsS --max-time 240 "http://127.0.0.1:3099/api/sources/propublica?query=STEM+education+nonprofit+California" 2>&1)
echo "$PP_RESPONSE" | node -e "
  const result = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (result.unavailable) { console.error('FAIL: unavailable=true'); process.exit(1); }
  if (result.error) { console.error('FAIL: ' + result.error); process.exit(1); }
  if (!Array.isArray(result.grants) || result.grants.length === 0) { console.error('FAIL: empty grants'); process.exit(1); }
  const first = result.grants[0];
  if (!first.title || !first.funder) { console.error('FAIL: missing fields'); process.exit(1); }
  console.log('PASS: ' + result.grants.length + ' grants. First: ' + first.title + ' / ' + first.funder);
"
echo "=== Smoke Test PASSED ==="
