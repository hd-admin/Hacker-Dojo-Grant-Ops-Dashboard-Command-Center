#!/bin/sh
set -eu

# Output version/help info when called with --version or --help anywhere in args
for arg in "$@"; do
    if [ "$arg" = "--version" ]; then
        echo "OpenCode 0.1.0-stub"
        exit 0
    fi
    if [ "$arg" = "--help" ]; then
        cat <<'EOF'
Usage: opencode [options] [command]

Options:
  --help       Show help
  --version    Show version

Commands:
  run          Run a prompt
EOF
        exit 0
    fi
done

# Read prompt from stdin
prompt=""
if [ ! -t 0 ]; then
    prompt=$(cat)
fi

# Also check CLI args for prompt (opencode-client.ts passes prompt as arg)
all_args="$*"
if [ -z "$prompt" ]; then
    prompt="$all_args"
fi

# Determine job type from prompt content
detect_job_type() {
    local p="$1"
    case "$p" in
        *"peer organizations"*|*"peer-discovery"*)
            echo "peer-discovery"
            ;;
        *"funder insights"*|*"funder-insights"*)
            echo "funder-insights"
            ;;
        *"eligibility"*|*"eligibility-vetting"*)
            echo "eligibility-vetting"
            ;;
        *"budget"*|*"budget-import"*)
            echo "budget-import"
            ;;
        *"draft"*|*"grant proposal"*)
            echo "draft"
            ;;
        *"crawl"*)
            echo "crawl"
            ;;
        *"match"*)
            echo "match"
            ;;
        *"extract"*)
            echo "extract"
            ;;
        *)
            echo "research"
            ;;
    esac
}

job_type=$(detect_job_type "$prompt")

# Get artifact path from environment
artifact_path="${ARTIFACT_PATH:-}"

# Generate timestamp
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Create output JSON based on job type
case "$job_type" in
    "peer-discovery")
        cat <<EOF
{"artifactType":"peer-discovery","jobId":"stub-peer-${timestamp}","timestamp":"${timestamp}","results":[{"funderName":"Community Innovation Foundation","funderType":"foundation","relevanceRationale":"Supports makerspaces and community technology hubs similar to Hacker Dojo","sourceOrganization":"Noisebridge","confidence":0.9},{"funderName":"Tech Education Fund","funderType":"corporate","relevanceRationale":"Funds STEM education programs in community spaces","sourceOrganization":"NYC Resistor","confidence":0.85}],"organizationsAnalyzed":6,"errors":[]}
EOF
        ;;
    "funder-insights")
        cat <<EOF
{"artifactType":"funder-insights","jobId":"stub-fi-${timestamp}","funderId":"funder-001","timestamp":"${timestamp}","patterns":[{"patternType":"giving-trend","description":"Increasing support for community technology education","confidence":"high","suggestedAction":"Apply for upcoming technology education grant cycle"},{"patternType":"hidden-giving","description":"Quietly supports makerspaces through community development grants","confidence":"medium","suggestedAction":"Frame proposal around community development impact"}],"givingTrends":[{"year":2024,"totalGiving":5000000,"grantsCount":25,"averageGrantSize":200000},{"year":2023,"totalGiving":4500000,"grantsCount":22,"averageGrantSize":204545}],"errors":[]}
EOF
        ;;
    "eligibility-vetting")
        cat <<EOF
{"artifactType":"eligibility-vetting","jobId":"stub-ev-${timestamp}","grantId":"stub-grant-001","timestamp":"${timestamp}","status":"meets-all","missingRequirements":[],"recommendation":"Hacker Dojo meets all eligibility requirements. Proceed with application.","checks":[{"requirement":"Nonprofit status (501(c)(3))","met":true,"detail":"Hacker Dojo is a registered 501(c)(3) nonprofit"},{"requirement":"Geographic eligibility","met":true,"detail":"Organization operates within eligible regions"},{"requirement":"Budget range fit","met":true,"detail":"Requested amount within allowable range"},{"requirement":"Program area alignment","met":true,"detail":"Technology education programs align with grant focus"}],"errors":[]}
EOF
        ;;
    "budget-import")
        cat <<EOF
{"artifactType":"budget-import","jobId":"stub-bi-${timestamp}","awardId":"award-001","timestamp":"${timestamp}","categories":[{"category":"Personnel","amount":"$45,000","restrictions":"Must be used for program staff only"},{"category":"Equipment","amount":"$20,000","restrictions":"Technology and tools"},{"category":"Programming","amount":"$10,000","restrictions":"Workshops and events"}],"totalBudget":"$75,000","errors":[]}
EOF
        ;;
    "draft")
        cat <<EOF
{"artifactType":"draft","jobId":"stub-draft-${timestamp}","grantId":"stub-grant-001","version":1,"timestamp":"${timestamp}","content":"# Grant Proposal\\n\\n## Executive Summary\\n\\nHacker Dojo is seeking funding...","sections":[{"sectionTitle":"Executive Summary","content":"Hacker Dojo is seeking funding...","groundingSources":["mission-statement"],"isGrounded":true,"wordCount":150},{"sectionTitle":"Program Design","content":"Our programs serve diverse populations...","groundingSources":["program-description"],"isGrounded":true,"wordCount":200},{"sectionTitle":"Organizational Qualifications","content":"With over a decade of experience...","groundingSources":["history"],"isGrounded":true,"wordCount":150},{"sectionTitle":"Budget","content":"Personnel: $45,000\\nEquipment: $20,000\\nProgramming: $10,000","groundingSources":["budget-proposal"],"isGrounded":true,"wordCount":50},{"sectionTitle":"Closing","content":"We believe this partnership will create lasting positive impact...","groundingSources":["impact-report"],"isGrounded":true,"wordCount":100}],"wordCount":650,"groundingDocumentIds":["mission-statement","annual-report","program-description","history","testimonials","budget-proposal","impact-report"],"groundingSourceUrls":["https://hackerdojo.com/mission","https://hackerdojo.com/annual-report"],"notes":"Generated by E2E test stub","errors":[]}
EOF
        ;;
    "crawl")
        cat <<EOF
{"artifactType":"crawl","runId":"stub-crawl-${timestamp}","sourceId":"stub-source-001","timestamp":"${timestamp}","status":"completed","grantsFound":[{"title":"Community Technology Grant","funder":"Tech Foundation","award":"$50,000","deadline":"2026-07-01","url":"https://example.com/grant","rawText":"Community Technology Grant for nonprofits..."}],"errorMessage":"","pagesCrawled":5,"pagesFailed":0}
EOF
        ;;
    "match")
        cat <<EOF
{"artifactType":"match","runId":"stub-match-${timestamp}","timestamp":"${timestamp}","matches":[{"grantTitle":"Community Technology Innovation Grant","grantId":"stub-grant-001","fitScore":85,"breakdown":{"missionAlignment":90,"geographicFocus":85,"programTrackrecord":80,"budgetCapacity":85,"partnershipReadiness":85},"rationale":"Strong alignment across all dimensions"}],"totalGrantsEvaluated":1,"grantsAboveThreshold":1}
EOF
        ;;
    "extract")
        cat <<EOF
{"artifactType":"extract","jobId":"stub-extract-${timestamp}","grantId":"stub-grant-001","timestamp":"${timestamp}","extracted":{"amount":"$75,000","startDate":"2026-01-01","endDate":"2026-12-31","reportingDeadlines":["Quarterly reports due by 15th of following month"],"complianceRequirements":["Maintain 501(c)(3) status","Submit annual audit"],"budgetCategories":[{"category":"Personnel","amount":"$45,000"},{"category":"Equipment","amount":"$20,000"},{"category":"Programming","amount":"$10,000"}],"restrictions":["Funds must be used within grant period"],"contacts":[{"name":"Jane Smith","role":"Program Officer","email":"jane@example.com"}]},"confidence":"high","sourceDocumentRef":"award-letter-001.pdf","errors":[]}
EOF
        ;;
    *)
        cat <<EOF
{"artifactType":"research","jobId":"stub-research-${timestamp}","timestamp":"${timestamp}","grants":[{"title":"Technology Community Innovation Grant","funder":"Tech Forward Foundation","funderShort":"TechForward","award":"$75,000","awardSort":75000,"deadline":"2026-08-15","deadlineConfidence":"exact","eligibility":"Open to 501(c)(3) organizations with technology education programs","requirements":["501(c)(3) status","Technology education focus","Annual report"],"externalUrl":"https://example.com/grant1","summary":"Supports community technology education initiatives","tags":["technology","education","community"],"category":"Technology Education"}],"evidence":[{"grantTitle":"Technology Community Innovation Grant","evidenceType":"fit_score","content":"Strong alignment with Hacker Dojo mission and programs","sourceUrl":"https://example.com/grant1"}],"rationale":"Found 1 highly relevant grant matching Hacker Dojo profile","sourcesFound":1,"grantsFound":1,"errors":[]}
EOF
        ;;
esac

exit 0
