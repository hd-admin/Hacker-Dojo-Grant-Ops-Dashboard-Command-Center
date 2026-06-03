#!/bin/sh
set -eu

all_args="$*"
json_output=0
case "$all_args" in
	*"Research grants for the following organization:"*|*"--output-format json"*|*"--format json"*)
		json_output=1
		;;
esac

if [ "$json_output" -eq 1 ]; then
	cat <<'EOF'
{"grants":[{"id":"stub-grant-001","title":"Education Technology Community Grant","funder":"Mock Foundation","funderShort":"Mock","award":"$50,000","awardSort":50000,"deadline":"2026-06-30","daysOut":30,"fit":82,"tags":["EdTech","Community"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-05-24T00:00:00.000Z"},{"id":"stub-grant-002","title":"Community Innovation Grant","funder":"Alliance for Learning","funderShort":"Alliance","award":"$75,000","awardSort":75000,"deadline":"2026-07-15","daysOut":45,"fit":76,"tags":["Community","Innovation"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-05-24T00:00:00.000Z"}],"evidence":[{"id":"stub-evidence-001","grantId":"stub-grant-001","sourceId":"stub-source-001","sourceName":"Stub Source","evidenceType":"eligibility","content":"Community alignment evidence","capturedAt":"2026-05-24T00:00:00.000Z"}],"rationale":"E2E research stub response"}
EOF
else
	cat <<'EOF'
## Hacker Dojo Grant Proposal

Hacker Dojo expands access to technology education and community innovation in Silicon Valley.

This draft is grounded in the uploaded organization profile and includes the grounded sentence exactly once.
EOF
fi
