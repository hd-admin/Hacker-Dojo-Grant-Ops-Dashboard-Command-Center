#!/bin/bash
set -euo pipefail

REAL_OPENCODE="/Users/mistlight/.opencode/bin/opencode"
prompt=""
output_format=""

while (($#)); do
  case "$1" in
    --prompt)
      shift
      prompt="${1:-}"
      ;;
    --output-format)
      shift
      output_format="${1:-}"
      ;;
  esac
  shift || true
done

if [ "$output_format" = "json" ]; then
  output="$($REAL_OPENCODE run 'hello' --pure --print-logs 2>/dev/null || true)"
  encoded_output="$(python3 - <<'PY' "$output"
import json, sys
print(json.dumps(sys.argv[1]))
PY
)"
  cat <<EOF
{"grants":[{"id":"real-opencode-001","title":"Real Opencode Community Grant","funder":"Real Opencode","funderShort":"Opencode","award":"$50,000","awardSort":50000,"deadline":"2026-06-30","daysOut":30,"fit":88,"tags":["EdTech","Community"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-05-24T00:00:00.000Z"}],"evidence":[{"source":"opencode","content":$encoded_output}],"rationale":"Real Opencode CLI output used"}
EOF
else
  exec "$REAL_OPENCODE" run 'hello' --pure --print-logs
fi
