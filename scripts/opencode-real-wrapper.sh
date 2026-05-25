#!/bin/bash
set -euo pipefail

REAL_OPENCODE="${OPENCODE_BIN:-$(command -v opencode || true)}"
if [ -z "$REAL_OPENCODE" ]; then
  echo "opencode executable not found on PATH" >&2
  exit 127
fi

passthrough_args=()

while [ $# -gt 0 ]; do
  case "$1" in
    --output-format)
      if [ $# -ge 2 ]; then
        shift 2
      else
        shift 1
      fi
      continue
      ;;
    --profile)
      if [ $# -ge 2 ]; then
        shift 2
      else
        shift 1
      fi
      continue
      ;;
    *)
      passthrough_args+=("$1")
      shift
      ;;
  esac
done

if [ "${OPENCODE_PURE:-}" = "1" ] || [ "${OPENCODE_PURE:-}" = "true" ] || [ "${OPENCODE_PURE:-}" = "yes" ]; then
  passthrough_args=("${passthrough_args[0]}" "--pure" "${passthrough_args[@]:1}")
fi

exec "$REAL_OPENCODE" "${passthrough_args[@]}"
