#!/bin/bash
# test-ensure-better-sqlite3.sh
# Exercises is_real_node(), resolve_real_node(), and ensure-better-sqlite3.sh flags.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the reusable library (no side effects, no exit on its own)
# shellcheck source=ensure-better-sqlite3-lib.sh
source "$SCRIPT_DIR/ensure-better-sqlite3-lib.sh"

# Create temp directory for mock binaries
TMP_DIR="$(mktemp -d /tmp/test-ensure-better-sqlite3-XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Helper: create a mock node binary that passes is_real_node at a given path
make_real_node_mock() {
  local target="$1"
  local version="$2"
  mkdir -p "$(dirname "$target")"
  cat > "$target" <<EOF
#!/bin/bash
if [ "\${1:-}" = "-e" ]; then
  printf 'node ${version}'
elif [ "\${1:-}" = "-v" ] || [ "\${1:-}" = "--version" ]; then
  echo 'v${version}'
fi
EOF
  chmod +x "$target"
}

# Helper: run a bash command inside a bwrap sandbox with /usr/bin/node disabled.
# This lets us exercise "no real Node available" and "only snap-wrapper node"
# scenarios without depending on the host filesystem layout.
# Optional second argument "with_node_mock" copies the mock node into the sandbox PATH.
_run_in_bwrap() {
  local cmd="$1"
  local with_node_mock="${2:-}"
  local bwrap_bin="$TMP_DIR/bwrap_bin"
  rm -rf "$bwrap_bin"
  mkdir -p "$bwrap_bin"
  # Copy utilities resolve_real_node needs. Fail fast if a required tool is missing.
  for util in ls sort tail awk grep readlink mkdir rmdir sleep date; do
    if [ -x "/usr/bin/$util" ] && [ ! -e "$bwrap_bin/$util" ]; then
      cp -f "/usr/bin/$util" "$bwrap_bin/$util"
    fi
  done
  # Copy the node mock into the sandbox PATH only when requested.
  if [ "$with_node_mock" = "1" ] && [ -x "$TMP_DIR/bin/node" ]; then
    cp -f "$TMP_DIR/bin/node" "$bwrap_bin/node"
  fi
  bwrap \
    --dev-bind / / \
    --bind /dev/null /usr/bin/node \
    --bind "$TMP_DIR" /tmp \
    --setenv PATH "/tmp/bwrap_bin:/usr/bin:/bin" \
    --setenv HOME "/tmp" \
    --setenv NVM_DIR "" \
    --setenv FNM_DIR "" \
    --setenv VOLTA_HOME "" \
    --setenv ASDF_DIR "" \
    --setenv PNPM_HOME "" \
    --chdir "$SCRIPT_DIR/.." \
    bash -c "$cmd"
}

MOCK_NODE="$TMP_DIR/mock-node-other"
cat > "$MOCK_NODE" <<'EOF'
#!/bin/bash
# Mock node binary that pretends to be Bun/Deno
if [ "${1:-}" = "-e" ]; then
  printf 'other'
fi
EOF
chmod +x "$MOCK_NODE"

FAKE_NODE_INCOMPLETE="$TMP_DIR/fake-node-incomplete"
cat > "$FAKE_NODE_INCOMPLETE" <<'EOF'
#!/bin/bash
# Mock node binary with process.release.name != node and missing versions.node
if [ "${1:-}" = "-e" ]; then
  printf 'incomplete'
fi
EOF
chmod +x "$FAKE_NODE_INCOMPLETE"

PASS="\x1b[32mPASS\x1b[0m"
FAIL="\x1b[31mFAIL\x1b[0m"
ANY_FAILED=0

echo "[test-ensure-better-sqlite3] is_real_node() tests"

if is_real_node "$MOCK_NODE"; then
  echo -e "$FAIL mock node returning 'other' was incorrectly accepted"
  ANY_FAILED=1
else
  echo -e "$PASS mock node returning 'other' was rejected"
fi

if is_real_node "$FAKE_NODE_INCOMPLETE"; then
  echo -e "$FAIL incomplete mock node was incorrectly accepted"
  ANY_FAILED=1
else
  echo -e "$PASS incomplete mock node was rejected"
fi

# Create a mock node that fails process.release.name but passes node -v
# (simulates snap/container wrappers). is_real_node should reject it;
# resolve_real_node should accept it via the semver fallback.
mkdir -p "$TMP_DIR/bin"
MOCK_NODE_FALLBACK="$TMP_DIR/bin/node"
cat > "$MOCK_NODE_FALLBACK" <<'EOF'
#!/bin/bash
# Mock node binary that fails process.release.name check but passes node -v
if [ "${1:-}" = "-v" ] || [ "${1:-}" = "--version" ]; then
  echo "v20.0.0"
  exit 0
fi
if [ "${1:-}" = "-e" ]; then
  # Returns "other" because process.release.name is not "node"
  printf 'other'
  exit 0
fi
exit 0
EOF
chmod +x "$MOCK_NODE_FALLBACK"

# Test the mock directly: is_real_node must reject it (no semver fallback there)
if is_real_node "$MOCK_NODE_FALLBACK"; then
  echo -e "$FAIL is_real_node incorrectly accepted snap/container wrapper (should reject)"
  ANY_FAILED=1
else
  echo -e "$PASS is_real_node rejects snap/container wrapper (resolve_real_node handles fallback)"
fi

if command -v bwrap >/dev/null 2>&1; then
  FALLBACK_RESOLVED="$(_run_in_bwrap 'source scripts/ensure-better-sqlite3-lib.sh; resolve_real_node 2>/dev/null' 1 || true)"
  if [ -n "$FALLBACK_RESOLVED" ] && [ "$FALLBACK_RESOLVED" = "/tmp/bwrap_bin/node" ]; then
    echo -e "$PASS resolve_real_node accepts snap/container wrapper via node -v fallback"
  else
    echo -e "$FAIL resolve_real_node did not accept snap/container wrapper via node -v fallback (got: $FALLBACK_RESOLVED)"
    ANY_FAILED=1
  fi
else
  echo -e "SKIP resolve_real_node snap/container fallback (bwrap not available)"
fi

# Find a real node binary
REAL_NODE_CANDIDATE=""
for candidate in "${NODE_PATH:-}" "$(command -v node 2>/dev/null || true)" "/usr/bin/node" "/usr/local/bin/node"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    REAL_NODE_CANDIDATE="$candidate"
    break
  fi
done

if [ -z "$REAL_NODE_CANDIDATE" ]; then
  echo -e "$FAIL no real Node binary found on this system"
  ANY_FAILED=1
elif is_real_node "$REAL_NODE_CANDIDATE"; then
  echo -e "$PASS real Node binary accepted: $REAL_NODE_CANDIDATE"
else
  echo -e "$FAIL real Node binary rejected: $REAL_NODE_CANDIDATE"
  ANY_FAILED=1
fi

echo "[test-ensure-better-sqlite3] resolve_real_node() tests"

# When NODE_PATH points at mock, resolve_real_node should still find real node (mock is skipped)
RESOLVED_WITH_MOCK="$(NODE_PATH="$MOCK_NODE" resolve_real_node 2>/dev/null || true)"
if [ -n "$RESOLVED_WITH_MOCK" ] && is_real_node "$RESOLVED_WITH_MOCK"; then
  echo -e "$PASS resolve_real_node skipped mock NODE_PATH and found real Node: $RESOLVED_WITH_MOCK"
else
  echo -e "$FAIL resolve_real_node did not produce expected output with mock NODE_PATH"
  ANY_FAILED=1
fi

# Test --diagnose flag path with mock NODE_PATH
DIAGNOSE_OUTPUT="$(NODE_PATH="$MOCK_NODE" bash "$SCRIPT_DIR/ensure-better-sqlite3.sh" --diagnose 2>&1 || true)"
if echo "$DIAGNOSE_OUTPUT" | grep -q 'resolved real Node:'; then
  echo -e "$PASS --diagnose flag prints resolved node and versions"
else
  echo -e "$FAIL --diagnose flag did not print expected output"
  ANY_FAILED=1
fi

# Save the original is_real_node so we can override it for controlled fallback tests
ORIG_IS_REAL_NODE="$(declare -f is_real_node)"

# --- NVM_DIR fallback test ---
NVM_TMP="$TMP_DIR/nvm"
make_real_node_mock "$NVM_TMP/versions/node/v22.0.0/bin/node" "22.0.0"
is_real_node() {
  local bin="$1"
  case "$bin" in
    "$NVM_TMP/versions/node/v22.0.0/bin/node") return 0 ;;
    *) return 1 ;;
  esac
}
NVM_RESOLVED="$(PATH="/usr/bin:/bin" HOME="$TMP_DIR" NVM_DIR="$NVM_TMP" resolve_real_node 2>/dev/null || true)"
if [ -n "$NVM_RESOLVED" ] && [ "$NVM_RESOLVED" = "$NVM_TMP/versions/node/v22.0.0/bin/node" ]; then
  echo -e "$PASS resolve_real_node falls back to NVM_DIR"
else
  echo -e "$FAIL resolve_real_node did not fall back to NVM_DIR (got: $NVM_RESOLVED)"
  ANY_FAILED=1
fi

# --- FNM_DIR fallback test ---
FNM_TMP="$TMP_DIR/fnm"
make_real_node_mock "$FNM_TMP/node-versions/v20.5.0/installation/bin/node" "20.5.0"
is_real_node() {
  local bin="$1"
  case "$bin" in
    "$FNM_TMP/node-versions/v20.5.0/installation/bin/node") return 0 ;;
    *) return 1 ;;
  esac
}
FNM_RESOLVED="$(PATH="/usr/bin:/bin" HOME="$TMP_DIR" FNM_DIR="$FNM_TMP" resolve_real_node 2>/dev/null || true)"
if [ -n "$FNM_RESOLVED" ] && [ "$FNM_RESOLVED" = "$FNM_TMP/node-versions/v20.5.0/installation/bin/node" ]; then
  echo -e "$PASS resolve_real_node falls back to FNM_DIR"
else
  echo -e "$FAIL resolve_real_node did not fall back to FNM_DIR (got: $FNM_RESOLVED)"
  ANY_FAILED=1
fi

# --- VOLTA_HOME fallback test ---
VOLTA_TMP="$TMP_DIR/volta"
make_real_node_mock "$VOLTA_TMP/bin/node" "18.20.0"
is_real_node() {
  local bin="$1"
  case "$bin" in
    "$VOLTA_TMP/bin/node") return 0 ;;
    *) return 1 ;;
  esac
}
VOLTA_RESOLVED="$(PATH="/usr/bin:/bin" HOME="$TMP_DIR" VOLTA_HOME="$VOLTA_TMP" resolve_real_node 2>/dev/null || true)"
if [ -n "$VOLTA_RESOLVED" ] && [ "$VOLTA_RESOLVED" = "$VOLTA_TMP/bin/node" ]; then
  echo -e "$PASS resolve_real_node falls back to VOLTA_HOME"
else
  echo -e "$FAIL resolve_real_node did not fall back to VOLTA_HOME (got: $VOLTA_RESOLVED)"
  ANY_FAILED=1
fi

# --- ASDF_DIR fallback test ---
ASDF_TMP="$TMP_DIR/asdf"
make_real_node_mock "$ASDF_TMP/installs/nodejs/20.10.0/bin/node" "20.10.0"
ASDF_BIN="$TMP_DIR/asdf_bin"
mkdir -p "$ASDF_BIN"
cat > "$ASDF_BIN/asdf" <<'EOF'
#!/bin/bash
if [ "${1:-}" = "current" ] && [ "${2:-}" = "nodejs" ]; then
  echo 'nodejs 20.10.0 /path/to/install'
fi
EOF
chmod +x "$ASDF_BIN/asdf"
is_real_node() {
  local bin="$1"
  case "$bin" in
    "$ASDF_TMP/installs/nodejs/20.10.0/bin/node") return 0 ;;
    *) return 1 ;;
  esac
}
ASDF_RESOLVED="$(PATH="$ASDF_BIN:/usr/bin:/bin" HOME="$TMP_DIR" ASDF_DIR="$ASDF_TMP" resolve_real_node 2>/dev/null || true)"
if [ -n "$ASDF_RESOLVED" ] && [ "$ASDF_RESOLVED" = "$ASDF_TMP/installs/nodejs/20.10.0/bin/node" ]; then
  echo -e "$PASS resolve_real_node falls back to ASDF_DIR"
else
  echo -e "$FAIL resolve_real_node did not fall back to ASDF_DIR (got: $ASDF_RESOLVED)"
  ANY_FAILED=1
fi

# --- Missing node error message test ---
# Run inside a sandbox where /usr/bin/node is not executable and no version
# manager directories exist, so resolve_real_node has to emit its error.
if command -v bwrap >/dev/null 2>&1; then
  MISSING_OUTPUT="$(_run_in_bwrap 'source scripts/ensure-better-sqlite3-lib.sh; resolve_real_node 2>&1' 0 || true)"
  if echo "$MISSING_OUTPUT" | grep -q 'could not resolve a real Node binary' && \
     echo "$MISSING_OUTPUT" | grep -q 'Candidates checked' && \
     echo "$MISSING_OUTPUT" | grep -q 'Fix:'; then
    echo -e "$PASS resolve_real_node emits helpful error when no Node found"
  else
    echo -e "$FAIL resolve_real_node missing expected error content"
    echo "Output was:"
    echo "$MISSING_OUTPUT"
    ANY_FAILED=1
  fi
else
  echo -e "SKIP resolve_real_node missing-node error (bwrap not available)"
fi

# Restore original is_real_node for remaining tests
eval "$ORIG_IS_REAL_NODE"

echo "[test-ensure-better-sqlite3] ensure-better-sqlite3.sh flag tests"

# --- --help flag test ---
HELP_OUTPUT="$(bash "$SCRIPT_DIR/ensure-better-sqlite3.sh" --help 2>&1)"
HELP_STATUS=$?
if [ "$HELP_STATUS" -eq 0 ] && \
   echo "$HELP_OUTPUT" | grep -q -- '--diagnose' && \
   echo "$HELP_OUTPUT" | grep -q -- '--skip-if-working' && \
   echo "$HELP_OUTPUT" | grep -q -- 'Usage:'; then
  echo -e "$PASS --help flag prints usage and exits 0"
else
  echo -e "$FAIL --help flag did not print expected usage (status=$HELP_STATUS)"
  ANY_FAILED=1
fi

# --- Exit 0 when better-sqlite3 already works ---
ALREADY_WORKS_STATUS=0
bash "$SCRIPT_DIR/ensure-better-sqlite3.sh" >/dev/null 2>&1 || ALREADY_WORKS_STATUS=$?
if [ "$ALREADY_WORKS_STATUS" -eq 0 ]; then
  echo -e "$PASS ensure-better-sqlite3.sh exits 0 when better-sqlite3 already works"
else
  echo -e "$FAIL ensure-better-sqlite3.sh did not exit 0 when module is working (status=$ALREADY_WORKS_STATUS)"
  ANY_FAILED=1
fi

if [ "$ANY_FAILED" -eq 1 ]; then
  echo "[test-ensure-better-sqlite3] FAILED"
  exit 1
fi

echo "[test-ensure-better-sqlite3] all tests passed"
