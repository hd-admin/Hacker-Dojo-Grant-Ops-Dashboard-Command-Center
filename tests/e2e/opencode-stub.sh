#!/usr/bin/env bash
set -uo pipefail

ARTIFACT_PATH="${ARTIFACT_PATH:-}"

# Handle --help and --version flags for health check handshake
for arg in "$@"; do
  if [ "$arg" = "--help" ] || [ "$arg" = "-h" ]; then
    cat << 'HELPEOF'
OpenCode - AI-powered code generation and grant operations tool

Usage: opencode [options]

Options:
  --help, -h         Show this help message
  --version, -V      Show version information
  --model MODEL      Specify the AI model to use
  --provider PROVIDER Use a specific AI provider
  --profile NAME     Use a named configuration profile
  --config PATH      Path to config file
  --prompt TEXT      Inline prompt text
  --message TEXT     Conversation message
  --input FILE       Read prompt from file
  --output FORMAT    Output format (json, text)
  --timeout SECONDS  Maximum execution time

Commands:
  run                Execute a task from a prompt

For grant operations, set ARTIFACT_PATH env var to specify output file.
HELPEOF
    exit 0
  fi
  if [ "$arg" = "--version" ] || [ "$arg" = "-V" ]; then
    echo "1.15.13"
    exit 0
  fi
done

if [ -z "$ARTIFACT_PATH" ]; then
  if [ $# -gt 0 ]; then
    exec "$0" --help
  fi
  echo 'OpenCode 0.1.0-stub' >&2
  exit 0
fi

mkdir -p "$(dirname "$ARTIFACT_PATH")"

ARTIFACT_NAME="$(basename "$ARTIFACT_PATH")"
JOB_ID="${ARTIFACT_NAME%.json}"
SOURCE_ID="${SOURCE_ID:-source-001}"
GRANT_ID="${GRANT_ID:-grant-001}"

python3 -c "
import json, os, sys
from datetime import datetime, timezone

artifact_path = os.environ['ARTIFACT_PATH']
job_id = os.environ.get('JOB_ID', 'unknown')
source_id = os.environ.get('SOURCE_ID', 'source-001')
grant_id = os.environ.get('GRANT_ID', 'grant-001')
ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

artifact = None

if 'crawl' in artifact_path:
    artifact = {
        'artifactType': 'crawl',
        'runId': job_id, 'sourceId': source_id, 'timestamp': ts,
        'status': 'completed',
        'grantsFound': [
            {'title': 'Community Technology Fund 2026', 'funder': 'Knight Foundation', 'award': '\$50,000 - \$250,000', 'deadline': '2026-09-15', 'url': 'https://knightfoundation.org/grants/tech-fund-2026'},
            {'title': 'Digital Innovation for Public Good', 'funder': 'Knight Foundation', 'award': '\$100,000 - \$500,000', 'deadline': '2026-11-01', 'url': 'https://knightfoundation.org/grants/digital-innovation'}
        ],
        'pagesCrawled': 3, 'pagesFailed': 0
    }
elif 'draft' in artifact_path:
    artifact = {
        'artifactType': 'draft', 'jobId': job_id, 'grantId': grant_id, 'version': 1, 'timestamp': ts,
        'content': 'Project Vision: Hacker Dojo AI Career Initiative. With 17-year track record. Why Hacker Dojo: Since 2009, 25,000+ members. Proposed Activities: 12-week AI curriculum.',
        'sections': [
            {'sectionTitle': 'Project Vision', 'content': 'Hacker Dojo AI Career Initiative.', 'groundingSources': ['doc-profile'], 'isGrounded': True, 'wordCount': 6},
            {'sectionTitle': 'Why Hacker Dojo', 'content': 'Since 2009, 25,000+ members.', 'groundingSources': ['doc-impact-report-2025'], 'isGrounded': True, 'wordCount': 6},
            {'sectionTitle': 'Proposed Activities', 'content': '12-week AI curriculum for 200 participants.', 'groundingSources': [], 'isGrounded': False, 'wordCount': 8}
        ],
        'wordCount': 20, 'groundingDocumentIds': ['doc-profile'], 'groundingSourceUrls': [], 'errors': []
    }
elif 'match' in artifact_path:
    artifact = {
        'artifactType': 'match', 'runId': job_id, 'timestamp': ts,
        'matches': [
            {'grantTitle': 'Community Technology Fund 2026', 'grantId': 'grant-001', 'fitScore': 85, 'breakdown': {'missionAlignment': 90, 'geographicFocus': 85, 'programTrackrecord': 80, 'budgetCapacity': 75, 'partnershipReadiness': 95}, 'rationale': 'Strong alignment.'},
            {'grantTitle': 'Digital Innovation for Public Good', 'grantId': 'grant-002', 'fitScore': 72, 'breakdown': {'missionAlignment': 75, 'geographicFocus': 70, 'programTrackrecord': 65, 'budgetCapacity': 60, 'partnershipReadiness': 90}, 'rationale': 'Good alignment.'}
        ],
        'totalGrantsEvaluated': 2, 'grantsAboveThreshold': 1
    }
elif 'extract' in artifact_path:
    artifact = {
        'artifactType': 'extract', 'jobId': job_id, 'grantId': grant_id, 'timestamp': ts,
        'extracted': {'amount': '\$250,000', 'startDate': '2026-10-01', 'endDate': '2028-09-30'},
        'confidence': 'high', 'sourceDocumentRef': 'award-letter.pdf', 'errors': []
    }
elif 'research' in artifact_path or 'peer-discovery' in artifact_path:
    if 'peer-discovery' in artifact_path:
        artifact = {'artifactType': 'peer-discovery', 'jobId': job_id, 'timestamp': ts, 'results': [{'funderName': 'Schmidt Family Foundation', 'funderType': 'foundation', 'relevanceRationale': 'Funds tech education.', 'sourceOrganization': 'Candid', 'confidence': 0.85}], 'organizationsAnalyzed': 5, 'errors': []}
    else:
        artifact = {
            'artifactType': 'research', 'jobId': job_id, 'timestamp': ts,
            'grants': [
                {'title': 'Community Technology Fund 2026', 'funder': 'Knight Foundation', 'funderShort': 'Knight', 'award': '\$50,000 - \$250,000', 'awardSort': 50000, 'deadline': '2026-09-15', 'deadlineConfidence': 'exact', 'requirements': ['501(c)(3) status'], 'externalUrl': 'https://knightfoundation.org/grants/tech-fund-2026', 'summary': 'Supports tech for communities.', 'tags': ['technology'], 'category': 'Technology'}
            ],
            'evidence': [], 'rationale': 'Found 1 grant.', 'sourcesFound': 1, 'grantsFound': 1, 'errors': []
        }
elif 'funder-insights' in artifact_path:
    artifact = {'artifactType': 'funder-insights', 'jobId': job_id, 'funderId': 'funder-knight', 'timestamp': ts, 'patterns': [{'patternType': 'giving-trend', 'description': 'Increased tech grants 40%.', 'confidence': 'high'}], 'errors': []}
elif 'eligibility-vetting' in artifact_path:
    artifact = {'artifactType': 'eligibility-vetting', 'jobId': job_id, 'grantId': grant_id, 'timestamp': ts, 'status': 'meets-all', 'missingRequirements': [], 'checks': [{'requirement': '501(c)(3)', 'met': True, 'detail': 'Registered.'}], 'errors': []}
elif 'budget-import' in artifact_path:
    artifact = {'artifactType': 'budget-import', 'jobId': job_id, 'awardId': 'award-001', 'timestamp': ts, 'categories': [{'category': 'Personnel', 'amount': '\$120,000'}], 'totalBudget': '\$250,000', 'errors': []}
else:
    artifact = {'artifactType': 'generic', 'jobId': job_id, 'timestamp': ts, 'status': 'completed', 'message': 'Stub artifact'}

with open(artifact_path, 'w') as f:
    json.dump(artifact, f, indent=2)
" 2>/dev/null
