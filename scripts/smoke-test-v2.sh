#!/usr/bin/env bash
# Smoke test for v2 agent job types against real OpenCode
# Not part of CI - consumes tokens. Documented release gate per AC-15.1.
# Usage: ./scripts/smoke-test-v2.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${PROJECT_DIR}/.grant-ops-data"
RESULTS_DIR="${DATA_DIR}/smoke-test-results"
VERSION="$(date +%Y%m%d-%H%M%S)"
RESULTS_FILE="${RESULTS_DIR}/${VERSION}.json"

mkdir -p "${RESULTS_DIR}"

echo "=== Grant Ops v2 Smoke Test ==="
echo "Version: ${VERSION}"
echo "Results: ${RESULTS_FILE}"
echo ""

JOB_TYPES=("research" "draft" "crawl" "match" "extract" "peer-discovery" "funder-insights" "eligibility-vetting" "budget-import")

declare -A RESULTS

for job_type in "${JOB_TYPES[@]}"; do
  echo "--- Testing: ${job_type} ---"
  START_TIME=$(date +%s)

  case "${job_type}" in
    research)
      RESPONSE=$(curl -s -X POST http://localhost:3000/api/research \
        -H 'Content-Type: application/json' \
        -d '{"query":"AI literacy grants for Bay Area makerspaces"}' 2>&1) || true
      ;;
    draft)
      RESPONSE=$(curl -s -X POST http://localhost:3000/api/grants/test-grant/draft \
        -H 'Content-Type: application/json' \
        -d '{"requirements":["Explain organization mission","Detail program approach"]}' 2>&1) || true
      ;;
    crawl)
      RESPONSE=$(curl -s -X POST http://localhost:3000/api/crawl/start \
        -H 'Content-Type: application/json' \
        -d '{"sourceId":"source-grants-gov"}' 2>&1) || true
      ;;
    match)
      RESPONSE=$(curl -s -X POST http://localhost:3000/api/match/start \
        -H 'Content-Type: application/json' \
        -d '{"grantIds":["test-grant-1"]}' 2>&1) || true
      ;;
    extract)
      RESPONSE=$(curl -s -X POST http://localhost:3000/api/extract/start \
        -H 'Content-Type: application/json' \
        -d '{"documentRef":"test-doc","grantId":"test-grant"}' 2>&1) || true
      ;;
    "peer-discovery")
      RESPONSE=$(curl -s -X POST http://localhost:3000/api/peer-discovery \
        -H 'Content-Type: application/json' \
        -d '{}' 2>&1) || true
      ;;
    "funder-insights")
      RESPONSE=$(curl -s -X POST http://localhost:3000/api/funder-insights \
        -H 'Content-Type: application/json' \
        -d '{"funderId":"funder-nsf","funderName":"National Science Foundation"}' 2>&1) || true
      ;;
    "eligibility-vetting")
      RESPONSE=$(curl -s -X POST http://localhost:3000/api/eligibility-vetting \
        -H 'Content-Type: application/json' \
        -d '{"grantId":"test-grant","requirements":"501(c)(3), Bay Area, STEM education"}' 2>&1) || true
      ;;
    "budget-import")
      RESPONSE=$(curl -s -X POST http://localhost:3000/api/budget-import \
        -H 'Content-Type: application/json' \
        -d '{"awardId":"test-award","documentRef":"test-budget"}' 2>&1) || true
      ;;
    *)
      RESPONSE="Unknown job type: ${job_type}"
      ;;
  esac

  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))

  # Extract jobId if present
  JOB_ID=$(echo "${RESPONSE}" | grep -o '"jobId":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "none")

  if echo "${RESPONSE}" | grep -q '"jobId"'; then
    STATUS="PASS"
  else
    STATUS="FAIL"
  fi

  RESULTS["${job_type}"]="{\"status\":\"${STATUS}\",\"duration_s\":${DURATION},\"jobId\":\"${JOB_ID}\",\"response\":$(echo "${RESPONSE}" | head -c 500)}"
  echo "  Status: ${STATUS}, Duration: ${DURATION}s, JobId: ${JOB_ID}"
  echo ""
done

# Write results
echo "{" > "${RESULTS_FILE}"
echo "  \"version\": \"${VERSION}\"," >> "${RESULTS_FILE}"
echo "  \"timestamp\": \"$(date -Iseconds)\"," >> "${RESULTS_FILE}"
echo "  \"results\": {" >> "${RESULTS_FILE}"

COUNT=0
for job_type in "${JOB_TYPES[@]}"; do
  COUNT=$((COUNT + 1))
  echo -n "    \"${job_type}\": ${RESULTS[${job_type}]}" >> "${RESULTS_FILE}"
  if [ ${COUNT} -lt ${#JOB_TYPES[@]} ]; then
    echo "," >> "${RESULTS_FILE}"
  else
    echo "" >> "${RESULTS_FILE}"
  fi
done

echo "  }" >> "${RESULTS_FILE}"
echo "}" >> "${RESULTS_FILE}"

echo "=== Smoke Test Complete ==="
echo "Results saved to: ${RESULTS_FILE}"

PASS_COUNT=0
FAIL_COUNT=0
for jt in "${JOB_TYPES[@]}"; do
  if echo "${RESULTS[${jt}]}" | grep -q '"PASS"'; then
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo "Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed out of ${#JOB_TYPES[@]}"
