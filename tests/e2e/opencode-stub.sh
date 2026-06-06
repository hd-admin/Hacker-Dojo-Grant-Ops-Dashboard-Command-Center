#!/bin/sh
set -eu

# Read prompt from stdin (discarded - we determine output by env/args)
cat > /dev/null

all_args="$*"

# Determine which artifact type to generate based on prompt content
case "$all_args" in
	*"peer-discovery"*)
		artifact_type="peer-discovery"
		;;
	*"funder-insights"*)
		artifact_type="funder-insights"
		;;
	*"eligibility-vetting"*)
		artifact_type="eligibility-vetting"
		;;
	*"Research grants for the following organization:"*|*"crawl"*|*"discover"*)
		artifact_type="research"
		;;
	*)
		artifact_type="draft"
		;;
esac

# Write artifact to the path specified by ARTIFACT_PATH
case "$artifact_type" in
	"peer-discovery")
		cat > "$ARTIFACT_PATH" <<'EOF'
{"artifactType":"peer-discovery","jobId":"stub-job","timestamp":"2026-05-24T00:00:00.000Z","results":[{"funderName":"Mock Foundation","funderType":"private","relevanceRationale":"Supports community technology spaces","sourceOrganization":"Noisebridge","confidence":0.9}],"organizationsAnalyzed":1}
EOF
		;;
	"funder-insights")
		cat > "$ARTIFACT_PATH" <<'EOF'
{"artifactType":"funder-insights","jobId":"stub-job","funderId":"funder-knight","timestamp":"2026-05-24T00:00:00.000Z","patterns":[{"patternName":"Community Focus","description":"Funds community-driven initiatives","frequency":"high","evidence":"Multiple community grants awarded"}],"givingTrends":[{"year":2025,"totalAmount":1000000,"grantCount":10}]}
EOF
		;;
	"eligibility-vetting")
		cat > "$ARTIFACT_PATH" <<'EOF'
{"artifactType":"eligibility-vetting","jobId":"stub-job","grantId":"grant-stub","timestamp":"2026-05-24T00:00:00.000Z","status":"meets-all","missingRequirements":[],"checks":[{"checkName":"501(c)(3)","passed":true,"notes":"Verified"}],"recommendation":"Proceed with application"}
EOF
		;;
	"research")
		cat > "$ARTIFACT_PATH" <<'EOF'
{"grants":[{"id":"stub-grant-001","title":"Education Technology Community Grant","funder":"Mock Foundation","funderShort":"Mock","award":"$50,000","awardSort":50000,"deadline":"2026-06-30","daysOut":30,"fit":82,"tags":["EdTech","Community"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-05-24T00:00:00.000Z"},{"id":"stub-grant-002","title":"Community Innovation Grant","funder":"Alliance for Learning","funderShort":"Alliance","award":"$75,000","awardSort":75000,"deadline":"2026-07-15","daysOut":45,"fit":76,"tags":["Community","Innovation"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-05-24T00:00:00.000Z"}],"evidence":[{"id":"stub-evidence-001","grantId":"stub-grant-001","sourceId":"stub-source-001","sourceName":"Stub Source","evidenceType":"eligibility","content":"Community alignment evidence","capturedAt":"2026-05-24T00:00:00.000Z"}],"rationale":"E2E research stub response"}
EOF
		;;
	"draft")
		cat > "$ARTIFACT_PATH" <<'EOF'
{"title":"Hacker Dojo Grant Proposal","sections":[{"title":"Executive Summary","content":"Hacker Dojo expands access to technology education.","wordCount":200,"isGrounded":true,"groundingSources":["profile.pdf"]},{"title":"Program Description","content":"This proposal outlines a comprehensive approach.","wordCount":300,"isGrounded":true,"groundingSources":["profile.pdf"]},{"title":"Budget Overview","content":"Budget details to be added.","wordCount":100,"isGrounded":false,"groundingSources":[]}],"wordCount":600,"groundedSentence":"This draft is grounded in the uploaded organization profile.","groundingScore":0.95}
EOF
		;;
esac

# Output success message to stdout
echo "Artifact written to $ARTIFACT_PATH"
