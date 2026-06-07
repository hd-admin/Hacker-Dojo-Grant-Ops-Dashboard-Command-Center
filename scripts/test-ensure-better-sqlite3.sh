#!/bin/bash
# test-ensure-better-sqlite3.sh
# Exercises is_real_node() with mock and real Node binaries.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the reusable library (no side effects, no exit on its own)
# shellcheck source=ensure-better-sqlite3-lib.sh
source "$SCRIPT_DIR/ensure-better-sqlite3-lib.sh"

# Create temp directory for mock binaries
TMP_DIR="$(mktemp -d /tmp/test-ensure-better-sqlite3-XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

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

if [ "$ANY_FAILED" -eq 1 ]; then
  echo "[test-ensure-better-sqlite3] FAILED"
  exit 1
fi

echo "[test-ensure-better-sqlite3] all tests passed"
