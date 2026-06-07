# ensure-better-sqlite3-lib.sh
# Reusable bash functions for resolving a real Node.js binary.
# Intended to be sourced by ensure-better-sqlite3.sh and test scripts.
#
# Usage: source ensure-better-sqlite3-lib.sh
# Then call is_real_node <path> and resolve_real_node

if [ -z "${BASH_VERSION:-}" ]; then
  echo "This script must be run with bash" >&2
  return 1 2>/dev/null || exit 1
fi

is_real_node() {
  # Returns 0 if $1 is a genuine Node.js binary (not Bun/Deno shim).
  # Validates both process.release.name === 'node' and process.versions.node exists.
  # Falls back to checking node -v output if process.release.name check fails
  # (some container/snap wrappers report a different release name).
  local node_bin="$1"
  if [ -z "$node_bin" ] || [ ! -x "$node_bin" ]; then
    return 1
  fi
  local check_output
  check_output=$("$node_bin" -e '
    const isNode = process.release?.name === "node";
    const hasVersion = typeof process.versions?.node === "string" && process.versions.node.length > 0;
    if (isNode && hasVersion) {
      process.stdout.write("node " + process.versions.node);
    } else if (!isNode) {
      process.stdout.write("other");
    } else {
      process.stdout.write("incomplete");
    }
  ' 2>/dev/null || echo 'error')
  case "$check_output" in
    node*) return 0 ;;
    *)
      # Fallback: accept if "node -v" returns a valid semver starting with "v"
      # and the binary path is executable. This handles snap/container wrappers
      # where process.release.name may not be exactly "node".
      local version_output
      version_output=$("$node_bin" -v 2>/dev/null || echo 'error')
      if [ -n "$version_output" ] && echo "$version_output" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+'; then
        return 0
      fi
      return 1
      ;;
  esac
}

resolve_real_node() {
  local candidates=()

  if [ -n "${NODE_PATH:-}" ] && [ -x "$NODE_PATH" ]; then
    candidates+=("$NODE_PATH")
  fi

  local which_node
  which_node="$(command -v node 2>/dev/null || echo "")"
  if [ -n "$which_node" ]; then
    candidates+=("$which_node")
  fi

  candidates+=(
    "/usr/bin/node"
    "/usr/local/bin/node"
    "/opt/node/bin/node"
  )

  local nvm_base
  if [ -n "${NVM_DIR:-}" ]; then
    nvm_base="$NVM_DIR"
  elif [ -n "${HOME:-}" ]; then
    nvm_base="$HOME/.nvm"
  fi
  if [ -n "${nvm_base:-}" ] && [ -d "$nvm_base/versions/node" ]; then
    local latest_nvm
    latest_nvm="$(ls -1 "$nvm_base/versions/node" 2>/dev/null | sort -V | tail -n 1 || echo "")"
    if [ -n "$latest_nvm" ]; then
      candidates+=("$nvm_base/versions/node/$latest_nvm/bin/node")
    fi
    if [ -x "$nvm_base/current/bin/node" ]; then
      candidates+=("$nvm_base/current/bin/node")
    fi
  fi

  if [ -x "/snap/bin/node" ]; then
    candidates+=("/snap/bin/node")
  fi

  if command -v flatpak >/dev/null 2>&1; then
    local check_output
    check_output="$(flatpak run --command=node org.freedesktop.Sdk -e 'process.stdout.write(process.release?.name === "node" && process.versions?.node ? "node " + process.versions.node : "other")' 2>/dev/null || echo 'error')"
    case "$check_output" in
      node*) candidates+=("flatpak:org.freedesktop.Sdk") ;;
    esac
  fi

  local pnpm_home
  if [ -n "${PNPM_HOME:-}" ] && [ -d "$PNPM_HOME" ]; then
    pnpm_home="$PNPM_HOME"
  elif [ -n "${HOME:-}" ] && [ -d "$HOME/.local/share/pnpm" ]; then
    pnpm_home="$HOME/.local/share/pnpm"
  fi
  if [ -n "${pnpm_home:-}" ] && [ -x "$pnpm_home/node" ]; then
    candidates+=("$pnpm_home/node")
  fi

  for candidate in "${candidates[@]}"; do
    if [ -z "$candidate" ]; then
      continue
    fi
    if [ "$candidate" = "flatpak:org.freedesktop.Sdk" ]; then
      # Flatpak cannot be used as a simple local binary path for node-gyp builds,
      # so we intentionally do not return it. It served as a validation candidate only.
      continue
    fi
    local resolved
    resolved="$(readlink -f "$candidate" 2>/dev/null || echo "$candidate")"
    if [ -z "$resolved" ] || [ ! -x "$resolved" ]; then
      continue
    fi
    if is_real_node "$resolved"; then
      echo "$resolved"
      return 0
    fi
  done

  if [ -n "${which_node:-}" ]; then
    local resolved
    resolved="$(readlink -f "$which_node" 2>/dev/null || echo "$which_node")"
    if [ -n "$resolved" ] && [ -x "$resolved" ] && is_real_node "$resolved"; then
      echo "$resolved"
      return 0
    fi
  fi

  echo "[ensure-better-sqlite3] ERROR: No Node.js binary found." >&2
  echo "  Common causes:" >&2
  echo "  - Node.js is not installed." >&2
  echo "  - node on PATH is a Bun/Deno shim (process.release.name != 'node')." >&2
  echo "  - HOME/NVM_DIR are unset and node is not on PATH." >&2
  echo "  Fix: Install Node.js v20+ from https://nodejs.org/ or use a version manager (nvm, fnm, volta)." >&2
  echo "  Candidates checked: ${candidates[*]}" >&2
  echo "  PATH: $PATH" >&2
  echo "  HOME: ${HOME:-<unset>}" >&2
  echo "  NVM_DIR: ${NVM_DIR:-<unset>}" >&2
  echo "  PNPM_HOME: ${PNPM_HOME:-<unset>}" >&2
  return 1
}
