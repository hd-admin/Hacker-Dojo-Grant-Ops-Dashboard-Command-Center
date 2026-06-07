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
  # Requires both process.release.name === 'node' and process.versions.node exists.
  # Does NOT fall back to node -v; callers should use resolve_real_node for that.
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
    *) return 1 ;;
  esac
}

resolve_real_node() {
  local candidates=()
  local checked_paths=()
  local failure_reasons=()

  if [ -n "${NODE_PATH:-}" ] && [ -x "$NODE_PATH" ]; then
    candidates+=("$NODE_PATH")
  fi

  local which_node
  which_node="$(command -v node 2>/dev/null || echo "")"

  # Corepack shim detection: if `node` on PATH returns a valid version but
  # is_real_node rejects it, try to resolve the real binary behind the shim
  # using process.execPath.
  if [ -n "$which_node" ]; then
    local shim_version
    shim_version=$("$which_node" -v 2>/dev/null || echo "")
    if [ -n "$shim_version" ] && echo "$shim_version" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+'; then
      if ! is_real_node "$which_node"; then
        local exec_path
        exec_path=$("$which_node" -e 'process.stdout.write(process.execPath)' 2>/dev/null || echo "")
        if [ -n "$exec_path" ] && [ -x "$exec_path" ] && is_real_node "$exec_path"; then
          echo "$exec_path"
          return 0
        fi
      fi
    fi
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

  # fnm support
  local fnm_base
  if [ -n "${FNM_DIR:-}" ]; then
    fnm_base="$FNM_DIR"
  elif [ -n "${HOME:-}" ]; then
    fnm_base="$HOME/.local/share/fnm"
  fi
  if [ -n "${fnm_base:-}" ] && [ -d "$fnm_base/node-versions" ]; then
    local latest_fnm
    latest_fnm="$(ls -1 "$fnm_base/node-versions" 2>/dev/null | sort -V | tail -n 1 || echo "")"
    if [ -n "$latest_fnm" ]; then
      candidates+=("$fnm_base/node-versions/$latest_fnm/installation/bin/node")
    fi
  fi
  if [ -n "${HOME:-}" ] && [ -d "$HOME/.fnm/node-versions" ]; then
    local latest_fnm_home
    latest_fnm_home="$(ls -1 "$HOME/.fnm/node-versions" 2>/dev/null | sort -V | tail -n 1 || echo "")"
    if [ -n "$latest_fnm_home" ]; then
      candidates+=("$HOME/.fnm/node-versions/$latest_fnm_home/installation/bin/node")
    fi
  fi

  # volta support
  if [ -n "${VOLTA_HOME:-}" ] && [ -x "$VOLTA_HOME/bin/node" ]; then
    candidates+=("$VOLTA_HOME/bin/node")
  elif [ -n "${HOME:-}" ] && [ -x "$HOME/.volta/bin/node" ]; then
    candidates+=("$HOME/.volta/bin/node")
  fi

  # asdf support
  if [ -n "${ASDF_DIR:-}" ] && [ -x "$ASDF_DIR/installs/nodejs/$(asdf current nodejs 2>/dev/null | awk '{print $2}')/bin/node" 2>/dev/null ]; then
    candidates+=("$ASDF_DIR/installs/nodejs/$(asdf current nodejs 2>/dev/null | awk '{print $2}')/bin/node")
  elif [ -n "${HOME:-}" ] && [ -x "$HOME/.asdf/bin/node" ]; then
    candidates+=("$HOME/.asdf/installs/nodejs/$(asdf current nodejs 2>/dev/null | awk '{print $2}')/bin/node")
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
    # If readlink -f returns empty (can happen with relative symlinks or snap wrappers),
    # fall back to the candidate path itself.
    if [ -z "$resolved" ]; then
      resolved="$candidate"
    fi
    checked_paths+=("$resolved")
    if [ ! -x "$resolved" ]; then
      failure_reasons+=("$resolved: not executable")
      continue
    fi
    if is_real_node "$resolved"; then
      echo "$resolved"
      return 0
    fi
    failure_reasons+=("$resolved: is_real_node rejected (not genuine Node.js)")
  done

  if [ -n "${which_node:-}" ]; then
    local resolved
    resolved="$(readlink -f "$which_node" 2>/dev/null || echo "$which_node")"
    # Handle case where readlink -f returns empty
    if [ -z "$resolved" ]; then
      resolved="$which_node"
    fi
    if [ -x "$resolved" ] && is_real_node "$resolved"; then
      echo "$resolved"
      return 0
    fi
  fi

  # Explicit fallback: try using node on PATH to print process.execPath directly.
  if [ -n "${which_node:-}" ]; then
    local exec_path
    exec_path=$("$which_node" -e 'process.stdout.write(process.execPath)' 2>/dev/null || echo "")
    if [ -n "$exec_path" ] && [ -x "$exec_path" ] && is_real_node "$exec_path"; then
      echo "$exec_path"
      return 0
    fi
    if [ -n "$exec_path" ]; then
      checked_paths+=("$exec_path (via process.execPath)")
      failure_reasons+=("$exec_path (via process.execPath): is_real_node rejected")
    fi
  fi

  # Final fallback: accept if node on PATH returns a valid semver via -v.
  # This handles snap/container wrappers where process.release.name may not
  # be exactly "node", but only after all stricter checks have failed.
  if [ -n "${which_node:-}" ]; then
    local version_output
    version_output=$("$which_node" -v 2>/dev/null || echo "")
    if [ -n "$version_output" ] && echo "$version_output" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+'; then
      local resolved
      resolved="$(readlink -f "$which_node" 2>/dev/null || echo "$which_node")"
      if [ -z "$resolved" ]; then
        resolved="$which_node"
      fi
      echo "$resolved"
      return 0
    fi
    checked_paths+=("$which_node (via -v semver fallback)")
    failure_reasons+=("$which_node (via -v semver fallback): did not return valid semver")
  fi

  echo "[ensure-better-sqlite3] ERROR: could not resolve a real Node binary." >&2
  echo "  Common causes:" >&2
  echo "  - Node.js is not installed." >&2
  echo "  - node on PATH is a corepack/Bun/Deno shim (process.release.name != 'node')." >&2
  echo "  - HOME/NVM_DIR are unset and node is not on PATH." >&2
  echo "  Fix: Install Node.js v20+ from https://nodejs.org/ or use a version manager (nvm, fnm, volta)." >&2
  echo "  Tip: Run 'bash scripts/ensure-better-sqlite3.sh --diagnose' for more details." >&2
  echo "" >&2
  echo "  Candidates checked (${#checked_paths[@]}):" >&2
  local reason
  for reason in "${failure_reasons[@]}"; do
    echo "    - $reason" >&2
  done
  echo "" >&2
  echo "  PATH: $PATH" >&2
  echo "  HOME: ${HOME:-<unset>}" >&2
  echo "  NVM_DIR: ${NVM_DIR:-<unset>}" >&2
  echo "  PNPM_HOME: ${PNPM_HOME:-<unset>}" >&2
  return 1
}
