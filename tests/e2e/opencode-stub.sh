#!/bin/sh
set -eu

# When called with --version, output version info
if echo "$@" | grep -q -- '--version'; then
  cat <<'EOF'
OpenCode 0.1.0-stub
EOF
  exit 0
fi

# When called with run --help, output CLI help
if echo "$@" | grep -q -- '--help'; then
  cat <<'EOF'
Usage: opencode run [options] <prompt>
Options:
  --format FORMAT    Output format (json, text)
  --help             Show this help message
Commands:
  run               Execute a prompt
  --version         Show version
EOF
  exit 0
fi

# Otherwise return valid research/draft JSON with grants, evidence, and rationale
cat <<'EOF'
{"grants":[{"id":"stub-grant-001","title":"E2E Stub Community Grant","funder":"E2E Stub Foundation","funderShort":"E2EStub","award":"$50,000","awardSort":50000,"deadline":"2026-12-31","daysOut":215,"fit":85,"tags":["Community","Technology"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-01-01T00:00:00.000Z","sourceUrl":"https://example.com","sourceName":"E2E Stub Source"},{"id":"stub-grant-002","title":"E2E Stub Innovation Grant","funder":"E2E Stub Alliance","funderShort":"E2EStubA","award":"$75,000","awardSort":75000,"deadline":"2027-01-15","daysOut":230,"fit":78,"tags":["Education","Innovation"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-01-01T00:00:00.000Z","sourceUrl":"https://example.com","sourceName":"E2E Stub Source"},{"id":"stub-grant-003","title":"E2E Stub Capacity Grant","funder":"E2E Stub Community","funderShort":"E2EStubC","award":"$25,000","awardSort":25000,"deadline":"2027-03-01","daysOut":275,"fit":72,"tags":["Community","Capacity"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-01-01T00:00:00.000Z","sourceUrl":"https://example.com","sourceName":"E2E Stub Source"}],"evidence":[{"id":"stub-evidence-001","grantId":"stub-grant-001","sourceId":"stub-source-001","sourceName":"E2E Stub Source","evidenceType":"eligibility","content":"Community alignment and technology impact fit funder priorities.","capturedAt":"2026-01-01T00:00:00.000Z"}],"rationale":"E2E stub research completed successfully across multiple aligned grants"}
EOF
