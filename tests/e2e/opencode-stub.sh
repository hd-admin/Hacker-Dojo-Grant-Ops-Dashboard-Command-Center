#!/bin/bash
set -euo pipefail

# Consume stdin silently (agent-loop writes the prompt to stdin)
cat > /dev/null 2>/dev/null || true

# OpenCode Stub for E2E Testing
#
# This stub replaces the real opencode binary during E2E tests.
# It writes a predefined artifact JSON file to ARTIFACT_PATH
# based on the job type detected from the path pattern.
#
# Pattern: tmp/{jobType}-{jobId}.json
#
# The ARTIFACT_PATH environment variable is set by agent-loop.ts.
# Fixture data is loaded from tests/e2e/fixtures/{jobType}-artifact.json.
# If no fixture exists for the job type, a minimal valid artifact is generated.

ARTIFACT_PATH="${ARTIFACT_PATH:-}"

if [ -z "$ARTIFACT_PATH" ]; then
  echo "ARTIFACT_PATH not set" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"

# Determine job type from artifact path
FILENAME=$(basename "$ARTIFACT_PATH")
JOB_TYPE=$(echo "$FILENAME" | sed -n 's/^\([a-z-]*\)-.*\.json$/\1/p')

# Extract job ID for artifacts that carry it
JOB_ID=$(echo "$FILENAME" | sed -n 's/^[a-z-]*-\(.*\)\.json$/\1/p')

# Ensure parent directory exists
mkdir -p "$(dirname "$ARTIFACT_PATH")"

# Try to load from fixture file first
FIXTURE_FILE="$FIXTURES_DIR/${JOB_TYPE}-artifact.json"
if [ -f "$FIXTURE_FILE" ]; then
  cp "$FIXTURE_FILE" "$ARTIFACT_PATH"
  exit 0
fi

# Fallback: generate a minimal valid artifact based on job type
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

case "$JOB_TYPE" in
  crawl)
    cat > "$ARTIFACT_PATH" << JSONEOF
{
  "artifactType": "crawl",
  "runId": "${JOB_ID:-crawl-stub}",
  "sourceId": "source-stub",
  "timestamp": "${TIMESTAMP}",
  "status": "completed",
  "grantsFound": [
    {
      "title": "Community Innovation Grant",
      "funder": "Test Foundation",
      "award": "50000",
      "deadline": "${TIMESTAMP}",
      "url": "https://example.com/grant"
    }
  ],
  "pagesCrawled": 5,
  "pagesFailed": 0
}
JSONEOF
    ;;

  research)
    cat > "$ARTIFACT_PATH" << JSONEOF
{
  "artifactType": "research",
  "jobId": "${JOB_ID:-research-stub}",
  "timestamp": "${TIMESTAMP}",
  "grants": [
    {
      "title": "Innovation Lab Grant",
      "funder": "Knight Foundation",
      "funderShort": "Knight",
      "award": "100000",
      "awardSort": 100000,
      "deadline": "${TIMESTAMP}",
      "deadlineConfidence": "estimated",
      "eligibility": "501(c)(3) nonprofit organizations",
      "requirements": ["Budget narrative", "Board roster"],
      "externalUrl": "https://knightfoundation.org/grants",
      "summary": "Funding for community innovation spaces.",
      "tags": ["innovation", "community", "technology"],
      "category": "Community Development"
    }
  ],
  "evidence": [
    {
      "grantTitle": "Innovation Lab Grant",
      "evidenceType": "fit_score",
      "content": "Strong match for community tech spaces",
      "sourceUrl": "https://knightfoundation.org"
    }
  ],
  "rationale": "Based on search criteria and funder profile matching",
  "sourcesFound": 1,
  "grantsFound": 1
}
JSONEOF
    ;;

  draft)
    cat > "$ARTIFACT_PATH" << JSONEOF
{
  "artifactType": "draft",
  "jobId": "${JOB_ID:-draft-stub}",
  "grantId": "grant-stub",
  "version": 1,
  "timestamp": "${TIMESTAMP}",
  "content": "Executive Summary\\n\\nHacker Dojo respectfully submits this proposal for the Innovation Lab Grant. Our makerspace serves over 1,000 community members annually, providing access to technology, education, and collaborative workspace.\\n\\nProject Description\\n\\nThe proposed project will expand our STEM education programs to reach underserved communities. We will offer 12 free workshops per month, provide 50 scholarships for low-income participants, and develop new curriculum in AI, robotics, and sustainable technology.\\n\\nOrganizational Capacity\\n\\nFounded in 2009, Hacker Dojo has a 15-year track record of delivering high-impact community programs. We maintain a 14,000 sq ft facility in Mountain View, CA, equipped with a full electronics lab, 3D printing station, woodworking shop, and classroom space. Our team includes 5 full-time staff and over 50 volunteer mentors.\\n\\nBudget Narrative\\n\\nThe total project budget is $100,000. Personnel costs ($50,000) cover program coordinator and instructor stipends. Equipment ($20,000) covers computers, robotics kits, and 3D printing materials. Facilities ($15,000) covers rent and utilities for workshop space. Marketing and outreach ($15,000) covers community engagement and participant recruitment.\\n\\nExpected Outcomes\\n\\nWe expect to serve 500+ participants in the first year, with 70% from underrepresented groups in tech. We will measure success through participant surveys, skills assessments, and job placement tracking for career-oriented participants.\\n\\nConclusion\\n\\nHacker Dojo is uniquely positioned to deliver this program, with our established community presence, technical expertise, and commitment to diversity in technology. We look forward to partnering with the Knight Foundation to expand access to STEM education.",
  "sections": [
    {
      "sectionTitle": "Executive Summary",
      "content": "Hacker Dojo respectfully submits this proposal for the Innovation Lab Grant. Our makerspace serves over 1,000 community members annually, providing access to technology, education, and collaborative workspace.",
      "groundingSources": ["https://hackerdojo.org/about"],
      "isGrounded": true,
      "wordCount": 42
    },
    {
      "sectionTitle": "Project Description",
      "content": "The proposed project will expand our STEM education programs to reach underserved communities. We will offer 12 free workshops per month, provide 50 scholarships for low-income participants, and develop new curriculum in AI, robotics, and sustainable technology.",
      "groundingSources": ["https://hackerdojo.org/programs"],
      "isGrounded": true,
      "wordCount": 52
    },
    {
      "sectionTitle": "Organizational Capacity",
      "content": "Founded in 2009, Hacker Dojo has a 15-year track record of delivering high-impact community programs. We maintain a 14,000 sq ft facility in Mountain View, CA, equipped with a full electronics lab, 3D printing station, woodworking shop, and classroom space.",
      "groundingSources": ["https://hackerdojo.org/about"],
      "isGrounded": true,
      "wordCount": 48
    },
    {
      "sectionTitle": "Budget Narrative",
      "content": "The total project budget is $100,000. Personnel costs ($50,000), Equipment ($20,000), Facilities ($15,000), Marketing and outreach ($15,000).",
      "groundingSources": [],
      "isGrounded": false,
      "wordCount": 28
    },
    {
      "sectionTitle": "Expected Outcomes",
      "content": "We expect to serve 500+ participants in the first year, with 70% from underrepresented groups in tech. We will measure success through participant surveys, skills assessments, and job placement tracking.",
      "groundingSources": [],
      "isGrounded": false,
      "wordCount": 38
    }
  ],
  "wordCount": 300,
  "groundingDocumentIds": [],
  "groundingSourceUrls": ["https://hackerdojo.org/about"],
  "notes": "Initial draft for Knight Foundation Innovation Lab Grant"
}
JSONEOF
    ;;

  match)
    cat > "$ARTIFACT_PATH" << JSONEOF
{
  "artifactType": "match",
  "runId": "${JOB_ID:-match-stub}",
  "timestamp": "${TIMESTAMP}",
  "matches": [
    {
      "grantTitle": "Innovation Lab Grant",
      "grantId": "grant-stub",
      "fitScore": 85,
      "breakdown": {
        "missionAlignment": 90,
        "geographicFocus": 85,
        "programTrackrecord": 80,
        "budgetCapacity": 75,
        "partnershipReadiness": 95
      },
      "rationale": "Strong alignment: Hacker Dojo's mission of community tech education matches Knight Foundation's innovation focus. Geographic fit in Bay Area. Proven program delivery track record."
    }
  ],
  "totalGrantsEvaluated": 1,
  "grantsAboveThreshold": 1
}
JSONEOF
    ;;

  extract)
    cat > "$ARTIFACT_PATH" << JSONEOF
{
  "artifactType": "extract",
  "jobId": "${JOB_ID:-extract-stub}",
  "grantId": "grant-stub",
  "timestamp": "${TIMESTAMP}",
  "extracted": {
    "amount": "100000",
    "startDate": "2026-01-01",
    "endDate": "2027-12-31",
    "reportingDeadlines": ["Quarterly progress reports", "Annual financial report"],
    "complianceRequirements": ["IRS Form 990 filing", "SAM.gov registration"],
    "budgetCategories": [
      { "category": "Personnel", "amount": "50000" },
      { "category": "Equipment", "amount": "20000" },
      { "category": "Facilities", "amount": "15000" },
      { "category": "Marketing", "amount": "15000" }
    ],
    "restrictions": ["No lobbying"],
    "contacts": [
      { "name": "Grant Manager", "role": "Program Officer", "email": "grants@example.com" }
    ]
  },
  "confidence": "high",
  "sourceDocumentRef": "award-letter.pdf"
}
JSONEOF
    ;;

  peer-discovery)
    cat > "$ARTIFACT_PATH" << JSONEOF
{
  "artifactType": "peer-discovery",
  "jobId": "${JOB_ID:-peer-stub}",
  "timestamp": "${TIMESTAMP}",
  "results": [
    {
      "funderName": "Schmidt Family Foundation",
      "funderType": "foundation",
      "relevanceRationale": "Comparable makerspace in Portland received $75K grant from Schmidt Family Foundation in 2025 for STEM outreach programs.",
      "sourceOrganization": "Portland Hackerspace",
      "confidence": 0.85
    },
    {
      "funderName": "Google.org",
      "funderType": "corporate",
      "relevanceRationale": "Noisebridge in San Francisco received Google.org grant for digital literacy programs for underserved communities.",
      "sourceOrganization": "Noisebridge",
      "confidence": 0.9
    }
  ],
  "organizationsAnalyzed": 5
}
JSONEOF
    ;;

  funder-insights)
    cat > "$ARTIFACT_PATH" << JSONEOF
{
  "artifactType": "funder-insights",
  "jobId": "${JOB_ID:-insights-stub}",
  "funderId": "funder-knight",
  "timestamp": "${TIMESTAMP}",
  "patterns": [
    {
      "patternType": "giving-trend",
      "description": "Knight Foundation increased community innovation funding by 22% year-over-year from 2024 to 2025.",
      "confidence": "high",
      "suggestedAction": "Apply early in the funding cycle for best chances."
    },
    {
      "patternType": "focus-shift",
      "description": "Knight Foundation appears to be shifting focus toward digital equity and AI literacy programs.",
      "confidence": "medium",
      "suggestedAction": "Emphasize digital equity components in proposals."
    }
  ],
  "givingTrends": [
    { "year": 2023, "totalGiving": 50000000, "grantsCount": 120, "averageGrantSize": 416667 },
    { "year": 2024, "totalGiving": 55000000, "grantsCount": 130, "averageGrantSize": 423077 },
    { "year": 2025, "totalGiving": 67000000, "grantsCount": 145, "averageGrantSize": 462069 }
  ]
}
JSONEOF
    ;;

  eligibility-vetting)
    cat > "$ARTIFACT_PATH" << JSONEOF
{
  "artifactType": "eligibility-vetting",
  "jobId": "${JOB_ID:-vetting-stub}",
  "grantId": "grant-stub",
  "timestamp": "${TIMESTAMP}",
  "status": "meets-all",
  "missingRequirements": [],
  "recommendation": "Hacker Dojo meets all eligibility requirements for this grant opportunity.",
  "checks": [
    {
      "requirement": "501(c)(3) nonprofit status",
      "met": true,
      "detail": "Hacker Dojo is a registered 501(c)(3) organization (EIN: 26-2921174)"
    },
    {
      "requirement": "Geographic eligibility (California)",
      "met": true,
      "detail": "Hacker Dojo operates in Mountain View, CA"
    },
    {
      "requirement": "Budget range match",
      "met": true,
      "detail": "Grant award range ($50K-$150K) matches Hacker Dojo's budget capacity"
    }
  ]
}
JSONEOF
    ;;

  budget-import)
    cat > "$ARTIFACT_PATH" << JSONEOF
{
  "artifactType": "budget-import",
  "jobId": "${JOB_ID:-budget-stub}",
  "awardId": "award-stub",
  "timestamp": "${TIMESTAMP}",
  "categories": [
    { "category": "Personnel", "amount": "50000" },
    { "category": "Equipment", "amount": "20000" },
    { "category": "Facilities", "amount": "15000" },
    { "category": "Marketing", "amount": "15000" }
  ],
  "totalBudget": "100000"
}
JSONEOF
    ;;

  *)
    echo "Unknown job type: $JOB_TYPE" >&2
    cat > "$ARTIFACT_PATH" << JSONEOF
{
  "artifactType": "research",
  "jobId": "${JOB_ID:-unknown-stub}",
  "timestamp": "${TIMESTAMP}",
  "grants": [],
  "evidence": [],
  "sourcesFound": 0,
  "grantsFound": 0,
  "errors": ["Unknown job type: ${JOB_TYPE}"]
}
JSONEOF
    ;;
esac

exit 0
