#!/usr/bin/env bash
# Canonical app port/host for shell scripts.
#
# Single source of truth: config/app.json (shared with the TypeScript runtime
# via shared/app-config.ts). Source this file to get APP_PORT / APP_HOST /
# APP_BASE_URL. Override at runtime with the PORT / APP_HOST env vars.
#
#   source "$(dirname "$0")/lib/app-config.sh"

__app_config_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
__repo_root="$(cd "${__app_config_lib_dir}/../.." && pwd)"

APP_PORT="${PORT:-$(node -p "require('${__repo_root}/config/app.json').port")}"
APP_HOST="${APP_HOST:-$(node -p "require('${__repo_root}/config/app.json').host")}"
APP_BASE_URL="http://${APP_HOST}:${APP_PORT}"

export APP_PORT APP_HOST APP_BASE_URL
