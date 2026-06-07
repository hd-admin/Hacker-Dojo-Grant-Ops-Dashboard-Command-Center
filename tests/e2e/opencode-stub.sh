#!/bin/sh
set -eu

# Determine artifact path from env (used by agent-loop)
ARTIFACT_PATH="${ARTIFACT_PATH:-}"

# If ARTIFACT_PATH is set, write a valid artifact based on job type inferred from path
if [ -n "$ARTIFACT_PATH" ]; then
  BASENAME="$(basename "$ARTIFACT_PATH")"
  JOB_TYPE=""
  case "$BASENAME" in
    research-*) JOB_TYPE="research" ;;
    draft-*) JOB_TYPE="draft" ;;
    crawl-*) JOB_TYPE="crawl" ;;
    match-*) JOB_TYPE="match" ;;
    extract-*) JOB_TYPE="extract" ;;
    peer-discovery-*) JOB_TYPE="peer-discovery" ;;
    funder-insights-*) JOB_TYPE="funder-insights" ;;
    eligibility-vetting-*) JOB_TYPE="eligibility-vetting" ;;
    budget-import-*) JOB_TYPE="budget-import" ;;
  esac

  TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  JOB_ID="$(echo "$BASENAME" | sed 's/[^-]*-//' | sed 's/\.json$//')"

  mkdir -p "$(dirname "$ARTIFACT_PATH")"

  case "$JOB_TYPE" in
    research)
      cat > "$ARTIFACT_PATH" <<EOF
{
  "artifactType": "research",
  "jobId": "$JOB_ID",
  "timestamp": "$TIMESTAMP",
  "grants": [
    {
      "title": "Test Grant for Makerspaces",
      "funder": "Test Funder",
      "funderShort": "TF",
      "award": "\$50,000",
      "awardSort": 50000,
      "deadline": "2026-12-31",
      "deadlineConfidence": "exact",
      "eligibility": "Nonprofits working in technology education",
      "requirements": ["501(c)(3) status", "Annual budget under \$1M"],
      "externalUrl": "https://example.com/grant",
      "summary": "A test grant for makerspace programs",
      "tags": ["makerspace", "education", "technology"],
      "category": "technology"
    }
  ],
  "evidence": [],
  "rationale": "Found one relevant grant",
  "sourcesFound": 1,
  "grantsFound": 1,
  "errors": []
}
EOF
      ;;
    draft)
      cat > "$ARTIFACT_PATH" <<EOF
{
  "artifactType": "draft",
  "jobId": "$JOB_ID",
  "grantId": "grant-stub",
  "version": 1,
  "timestamp": "$TIMESTAMP",
  "content": "This is a comprehensive draft proposal for the Test Grant. It includes multiple sections with detailed content about the project vision, organizational capacity, and implementation plan. Hacker Dojo has a 17-year track record of serving the Silicon Valley technology community through its makerspace operations, educational programs, and community events. The proposed project will expand access to technology education and community innovation in Silicon Valley. This draft contains sufficient content to meet the minimum word count requirement of 500 words. The project aligns with Hacker Dojo's mission to expand access to technology education and community innovation in Silicon Valley. Hacker Dojo's AI Career Initiative provides training and mentorship for individuals seeking careers in artificial intelligence and related fields. The makerspace operations include 3D printers, laser cutters, CNC machines, and electronics workstations available to members and the public.",
  "sections": [
    {
      "sectionTitle": "Project Vision",
      "content": "Hacker Dojo expands access to technology education and community innovation in Silicon Valley. Our 17-year track record includes successful makerspace operations, the AI Career Initiative, and numerous community programs. We seek funding to expand these programs and reach more underserved populations in the Bay Area.",
      "groundingSources": ["org-profile"],
      "isGrounded": true,
      "wordCount": 50
    },
    {
      "sectionTitle": "Why Hacker Dojo",
      "content": "Hacker Dojo has been a cornerstone of the Silicon Valley technology community for 17 years. Our makerspace operations provide access to cutting-edge tools and equipment. The AI Career Initiative has trained hundreds of individuals. Our community events bring together entrepreneurs, developers, and creatives. We have the infrastructure, expertise, and community trust to execute this project successfully.",
      "groundingSources": ["org-profile", "past-awards"],
      "isGrounded": true,
      "wordCount": 60
    },
    {
      "sectionTitle": "Proposed Activities",
      "content": "We propose to expand our makerspace hours, launch new AI literacy workshops, and create mentorship programs for underrepresented groups in technology. These activities directly align with the funder's priorities and leverage Hacker Dojo's existing strengths.",
      "groundingSources": ["grant-requirements"],
      "isGrounded": true,
      "wordCount": 40
    },
    {
      "sectionTitle": "Budget",
      "content": "The total budget for this project is \$500,000 over two years. Major categories include personnel (60%), equipment (20%), and program materials (20%). This budget reflects our experience running similar programs and ensures sustainable operations.",
      "groundingSources": ["budget-template"],
      "isGrounded": true,
      "wordCount": 40
    },
    {
      "sectionTitle": "Evaluation",
      "content": "We will measure success through participant numbers, skill assessments, and longitudinal tracking of career outcomes. Our evaluation framework has been refined over 17 years of program delivery.",
      "groundingSources": ["evaluation-framework"],
      "isGrounded": true,
      "wordCount": 30
    },
    {
      "sectionTitle": "Sustainability",
      "content": "Hacker Dojo has maintained financial sustainability for 17 years through diverse revenue streams including membership dues, event fees, grants, and corporate partnerships. This project will build on that foundation.",
      "groundingSources": ["financial-records"],
      "isGrounded": true,
      "wordCount": 35
    }
  ],
  "wordCount": 600,
  "groundingDocumentIds": ["doc-1"],
  "groundingSourceUrls": ["https://hackerdojo.com"],
  "notes": "Test draft generated by stub",
  "errors": []
}
EOF
      ;;
    crawl)
      cat > "$ARTIFACT_PATH" <<EOF
{
  "artifactType": "crawl",
  "runId": "$JOB_ID",
  "sourceId": "source-stub",
  "timestamp": "$TIMESTAMP",
  "status": "completed",
  "grantsFound": [
    {
      "title": "Crawled Grant",
      "funder": "Crawled Funder",
      "award": "\$25,000",
      "deadline": "2026-12-31",
      "url": "https://example.com/crawled"
    }
  ],
  "pagesCrawled": 1,
  "pagesFailed": 0
}
EOF
      ;;
    match)
      cat > "$ARTIFACT_PATH" <<EOF
{
  "artifactType": "match",
  "runId": "$JOB_ID",
  "timestamp": "$TIMESTAMP",
  "matches": [
    {
      "grantTitle": "Test Grant",
      "grantId": "grant-stub",
      "fitScore": 85,
      "breakdown": {
        "missionAlignment": 90,
        "geographicFocus": 80,
        "programTrackrecord": 85,
        "budgetCapacity": 75,
        "partnershipReadiness": 90
      },
      "rationale": "Strong alignment with Hacker Dojo mission"
    },
    {
      "grantTitle": "Another Grant",
      "grantId": "grant-stub-2",
      "fitScore": 70,
      "breakdown": {
        "missionAlignment": 75,
        "geographicFocus": 70,
        "programTrackrecord": 65,
        "budgetCapacity": 80,
        "partnershipReadiness": 60
      },
      "rationale": "Moderate alignment with some gaps"
    }
  ],
  "totalGrantsEvaluated": 2,
  "grantsAboveThreshold": 1
}
EOF
      ;;
    extract)
      cat > "$ARTIFACT_PATH" <<EOF
{
  "artifactType": "extract",
  "jobId": "$JOB_ID",
  "grantId": "grant-stub",
  "timestamp": "$TIMESTAMP",
  "extracted": {
    "amount": "\$100,000",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "reportingDeadlines": ["2026-06-30", "2026-12-31"],
    "complianceRequirements": ["Annual report", "Financial audit"],
    "budgetCategories": [
      { "category": "Personnel", "amount": "\$60,000" },
      { "category": "Equipment", "amount": "\$25,000" },
      { "category": "Overhead", "amount": "\$15,000" }
    ],
    "restrictions": ["Must be 501(c)(3)"],
    "contacts": [
      { "name": "Jane Smith", "role": "Program Officer", "email": "jane@example.com" }
    ]
  },
  "confidence": "high",
  "sourceDocumentRef": "award-letter.txt",
  "errors": []
}
EOF
      ;;
    peer-discovery)
      cat > "$ARTIFACT_PATH" <<EOF
{
  "artifactType": "peer-discovery",
  "jobId": "$JOB_ID",
  "timestamp": "$TIMESTAMP",
  "results": [
    {
      "funderName": "Peer Funder One",
      "funderType": "foundation",
      "relevanceRationale": "Strong alignment with makerspace education",
      "sourceOrganization": "Hacker Dojo",
      "confidence": 0.85
    },
    {
      "funderName": "Peer Funder Two",
      "funderType": "community",
      "relevanceRationale": "Supports community technology programs",
      "sourceOrganization": "Hacker Dojo",
      "confidence": 0.75
    }
  ],
  "organizationsAnalyzed": 2,
  "errors": []
}
EOF
      ;;
    funder-insights)
      cat > "$ARTIFACT_PATH" <<EOF
{
  "artifactType": "funder-insights",
  "jobId": "$JOB_ID",
  "funderId": "funder-knight",
  "timestamp": "$TIMESTAMP",
  "patterns": [
    {
      "patternType": "giving-trend",
      "description": "Increasing focus on technology education grants",
      "confidence": "high",
      "suggestedAction": "Emphasize education components in proposals"
    },
    {
      "patternType": "focus-shift",
      "description": "Recent shift toward community-based programs",
      "confidence": "medium",
      "suggestedAction": "Highlight community impact and partnerships"
    }
  ],
  "givingTrends": [
    {
      "year": 2024,
      "totalGiving": 5000000,
      "grantsCount": 50,
      "averageGrantSize": 100000
    }
  ],
  "errors": []
}
EOF
      ;;
    eligibility-vetting)
      cat > "$ARTIFACT_PATH" <<EOF
{
  "artifactType": "eligibility-vetting",
  "jobId": "$JOB_ID",
  "grantId": "grant-stub",
  "timestamp": "$TIMESTAMP",
  "status": "meets-all",
  "missingRequirements": [],
  "recommendation": "Hacker Dojo meets all eligibility requirements for this grant",
  "checks": [
    {
      "requirement": "501(c)(3) status",
      "met": true,
      "detail": "Hacker Dojo is a registered 501(c)(3) nonprofit"
    },
    {
      "requirement": "Geographic focus in California",
      "met": true,
      "detail": "Located in Mountain View, CA"
    },
    {
      "requirement": "Technology education mission",
      "met": true,
      "detail": "Core mission aligns with grant focus"
    }
  ],
  "errors": []
}
EOF
      ;;
    budget-import)
      cat > "$ARTIFACT_PATH" <<EOF
{
  "artifactType": "budget-import",
  "jobId": "$JOB_ID",
  "awardId": "award-stub",
  "timestamp": "$TIMESTAMP",
  "categories": [
    { "category": "Personnel", "amount": "\$60,000", "restrictions": "None" },
    { "category": "Equipment", "amount": "\$25,000", "restrictions": "Must be capital assets" },
    { "category": "Overhead", "amount": "\$15,000" }
  ],
  "totalBudget": "\$100,000",
  "errors": []
}
EOF
      ;;
    *)
      cat > "$ARTIFACT_PATH" <<EOF
{
  "artifactType": "$JOB_TYPE",
  "jobId": "$JOB_ID",
  "timestamp": "$TIMESTAMP",
  "errors": []
}
EOF
      ;;
  esac
fi

# Handle the 'run' command used by opencode-client.ts
if [ "${1:-}" = "run" ]; then
  # Detect which operation based on prompt content
  # Get the last argument (the prompt) in POSIX-compatible way
  for PROMPT in "$@"; do true; done
  
  if echo "$PROMPT" | grep -qi "peer.*discovery\|peer organizations"; then
    cat <<EOF
{
  "artifactType": "peer-discovery",
  "jobId": "peer-stub",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "results": [
    {
      "funderName": "Peer Funder One",
      "funderType": "foundation",
      "relevanceRationale": "Strong alignment with makerspace education",
      "sourceOrganization": "Hacker Dojo",
      "confidence": 0.85
    },
    {
      "funderName": "Peer Funder Two",
      "funderType": "community",
      "relevanceRationale": "Supports community technology programs",
      "sourceOrganization": "Hacker Dojo",
      "confidence": 0.75
    }
  ],
  "organizationsAnalyzed": 2,
  "errors": []
}
EOF
    exit 0
  fi

  if echo "$PROMPT" | grep -qi "funder.*insight\|funding patterns"; then
    cat <<EOF
{
  "artifactType": "funder-insights",
  "jobId": "fi-stub",
  "funderId": "funder-knight",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "patterns": [
    {
      "patternType": "giving-trend",
      "description": "Increasing focus on technology education grants",
      "confidence": "high",
      "suggestedAction": "Emphasize education components in proposals"
    }
  ],
  "givingTrends": [
    {
      "year": 2024,
      "totalGiving": 5000000,
      "grantsCount": 50,
      "averageGrantSize": 100000
    }
  ],
  "errors": []
}
EOF
    exit 0
  fi

  if echo "$PROMPT" | grep -qi "eligibility\|eligible"; then
    cat <<EOF
{
  "artifactType": "eligibility-vetting",
  "jobId": "ev-stub",
  "grantId": "grant-stub",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "meets-all",
  "missingRequirements": [],
  "recommendation": "Hacker Dojo meets all eligibility requirements for this grant",
  "checks": [
    {
      "requirement": "501(c)(3) status",
      "met": true,
      "detail": "Hacker Dojo is a registered 501(c)(3) nonprofit"
    },
    {
      "requirement": "Geographic focus in California",
      "met": true,
      "detail": "Located in Mountain View, CA"
    },
    {
      "requirement": "Technology education mission",
      "met": true,
      "detail": "Core mission aligns with grant focus"
    }
  ],
  "errors": []
}
EOF
    exit 0
  fi

  if echo "$PROMPT" | grep -qi "research\|grant opportunities"; then
    cat <<EOF
{
  "artifactType": "research",
  "jobId": "research-stub",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "grants": [
    {
      "title": "Test Grant for Makerspaces",
      "funder": "Test Funder",
      "funderShort": "TF",
      "award": "\$50,000",
      "awardSort": 50000,
      "deadline": "2026-12-31",
      "deadlineConfidence": "exact",
      "eligibility": "Nonprofits working in technology education",
      "requirements": ["501(c)(3) status"],
      "externalUrl": "https://example.com/grant",
      "summary": "A test grant for makerspace programs",
      "tags": ["makerspace", "education", "technology"],
      "category": "technology"
    }
  ],
  "evidence": [],
  "rationale": "Found one relevant grant",
  "sourcesFound": 1,
  "grantsFound": 1,
  "errors": []
}
EOF
    exit 0
  fi

  if echo "$PROMPT" | grep -qi "draft\|proposal"; then
    cat <<EOF
{
  "artifactType": "draft",
  "jobId": "draft-stub",
  "grantId": "grant-stub",
  "version": 1,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "content": "This is a comprehensive draft proposal. Hacker Dojo has a 17-year track record of serving the Silicon Valley technology community through its makerspace operations, educational programs, and community events. The proposed project will expand access to technology education and community innovation in Silicon Valley.",
  "sections": [
    {
      "sectionTitle": "Project Vision",
      "content": "Hacker Dojo expands access to technology education and community innovation in Silicon Valley. Our 17-year track record includes successful makerspace operations, the AI Career Initiative, and numerous community programs.",
      "groundingSources": ["org-profile"],
      "isGrounded": true,
      "wordCount": 50
    },
    {
      "sectionTitle": "Why Hacker Dojo",
      "content": "Hacker Dojo has been a cornerstone of the Silicon Valley technology community for 17 years. Our makerspace operations provide access to cutting-edge tools and equipment.",
      "groundingSources": ["org-profile"],
      "isGrounded": true,
      "wordCount": 60
    },
    {
      "sectionTitle": "Proposed Activities",
      "content": "We propose to expand our makerspace hours, launch new AI literacy workshops, and create mentorship programs for underrepresented groups in technology.",
      "groundingSources": ["grant-requirements"],
      "isGrounded": true,
      "wordCount": 40
    },
    {
      "sectionTitle": "Budget",
      "content": "The total budget for this project is \$500,000 over two years. Major categories include personnel (60%), equipment (20%), and program materials (20%).",
      "groundingSources": ["budget-template"],
      "isGrounded": true,
      "wordCount": 40
    },
    {
      "sectionTitle": "Evaluation",
      "content": "We will measure success through participant numbers, skill assessments, and longitudinal tracking of career outcomes.",
      "groundingSources": ["evaluation-framework"],
      "isGrounded": true,
      "wordCount": 30
    },
    {
      "sectionTitle": "Sustainability",
      "content": "Hacker Dojo has maintained financial sustainability for 17 years through diverse revenue streams including membership dues, event fees, grants, and corporate partnerships.",
      "groundingSources": ["financial-records"],
      "isGrounded": true,
      "wordCount": 35
    }
  ],
  "wordCount": 600,
  "groundingDocumentIds": ["doc-1"],
  "groundingSourceUrls": ["https://hackerdojo.com"],
  "notes": "Test draft generated by stub",
  "errors": []
}
EOF
    exit 0
  fi

  # Default: return empty JSON for unknown run commands
  cat <<EOF
{}
EOF
  exit 0
fi

echo "OpenCode 0.1.0-stub"
