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

model_flag=""
if [ -n "${OPENCODE_MODEL:-}" ]; then
  model_flag="--model ${OPENCODE_MODEL}"
fi

permission_flag=""
if [ "${OPENCODE_SKIP_PERMISSIONS:-}" = "1" ] || [ "${OPENCODE_SKIP_PERMISSIONS:-}" = "true" ] || [ "${OPENCODE_SKIP_PERMISSIONS:-}" = "yes" ] || [ "${OPENCODE_DANGEROUSLY_SKIP_PERMISSIONS:-}" = "1" ] || [ "${OPENCODE_DANGEROUSLY_SKIP_PERMISSIONS:-}" = "true" ] || [ "${OPENCODE_DANGEROUSLY_SKIP_PERMISSIONS:-}" = "yes" ]; then
  permission_flag="--dangerously-skip-permissions"
fi

if [ "${OPENCODE_PURE:-}" = "1" ] || [ "${OPENCODE_PURE:-}" = "true" ] || [ "${OPENCODE_PURE:-}" = "yes" ]; then
  if [ -n "$permission_flag" ] && [ -n "$model_flag" ]; then
    exec "$REAL_OPENCODE" --pure $permission_flag $model_flag "${passthrough_args[@]}"
  elif [ -n "$permission_flag" ]; then
    exec "$REAL_OPENCODE" --pure $permission_flag "${passthrough_args[@]}"
  elif [ -n "$model_flag" ]; then
    exec "$REAL_OPENCODE" --pure $model_flag "${passthrough_args[@]}"
  else
    exec "$REAL_OPENCODE" --pure "${passthrough_args[@]}"
  fi
fi

if [ -n "$permission_flag" ] && [ -n "$model_flag" ]; then
  exec "$REAL_OPENCODE" $permission_flag $model_flag "${passthrough_args[@]}"
elif [ -n "$permission_flag" ]; then
  exec "$REAL_OPENCODE" $permission_flag "${passthrough_args[@]}"
elif [ -n "$model_flag" ]; then
  exec "$REAL_OPENCODE" $model_flag "${passthrough_args[@]}"
else
  exec "$REAL_OPENCODE" "${passthrough_args[@]}"
fi
