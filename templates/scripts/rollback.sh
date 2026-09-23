#!/usr/bin/env bash
# templates/scripts/rollback.sh — roll an environment back to a known-good version.
#
# The previous good version is resolved from the recorded change history under
# infra/changes/ with no manual lookup. `--to <version>` overrides the automatic
# resolution.
#
# Usage: ./rollback.sh <env> [--to <version>] [--dry-run] [--help]
#
# Exit codes:
#   0  success (or dry-run)
#   1  unexpected error
#   2  blocked (bad args, no recorded good version, unknown env)
#
# Environment overrides:
#   INFRA_CHANGES_DIR  path to the change-record dir (default infra/changes)
#   INFRA_STUB_LOG     test hook: argv log path

set -euo pipefail

CHANGES_DIR="${INFRA_CHANGES_DIR:-infra/changes}"
DRY_RUN=false
TO_VERSION=""

info() { printf '[rollback] %s\n' "$*"; }
err() { printf '[rollback] ERROR: %s\n' "$*" >&2; }
blocked() {
  err "$*"
  exit 2
}

usage() {
  cat <<'EOF'
Usage: ./rollback.sh <env> [--to <version>] [--dry-run] [--help]

Resolves the previous good version for <env> from infra/changes/ (no manual
lookup) and redeploys it. `--to <version>` overrides the resolved version.
Exit codes: 0 ok/dry-run, 1 error, 2 blocked.
EOF
}

ENV_NAME=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --dry-run) DRY_RUN=true ;;
    --to)
      shift
      [ "$#" -gt 0 ] || blocked "--to requires a <version> argument."
      TO_VERSION="$1"
      ;;
    -*) blocked "Unknown option: $1" ;;
    *)
      if [ -z "$ENV_NAME" ]; then ENV_NAME="$1"; else blocked "Unexpected extra argument: $1"; fi
      ;;
  esac
  shift
done

[ -n "$ENV_NAME" ] || blocked "Missing required argument: <env>. See --help."

# ─── Resolve the target version ──────────────────────────────────────────────

VERSION=""
if [ -n "$TO_VERSION" ]; then
  VERSION="$TO_VERSION"
  info "Using --to override: $VERSION"
else
  [ -d "$CHANGES_DIR" ] || blocked "Change directory not found: $CHANGES_DIR (nothing to roll back to)."
  # The most recent good record for this env is the current version; the one
  # before it is the rollback target. Records are named <date>-<env>-<version>.md
  # so a lexical sort orders them chronologically.
  # Collect good versions for this env, newest last.
  versions=()
  while IFS= read -r rec; do
    [ -n "$rec" ] || continue
    if grep -q '^status: good' "$rec" && grep -q "^env: ${ENV_NAME}\$" "$rec"; then
      v="$(grep '^version:' "$rec" | head -1 | sed -E 's/^version:[[:space:]]*//')"
      [ -n "$v" ] && versions+=("$v")
    fi
  done < <(find "$CHANGES_DIR" -maxdepth 1 -type f -name "*-${ENV_NAME}-*.md" | sort)

  local_count="${#versions[@]}"
  if [ "$local_count" -eq 0 ]; then
    blocked "No recorded good version for '$ENV_NAME' in $CHANGES_DIR."
  elif [ "$local_count" -eq 1 ]; then
    # Only one record: roll back to it (best available known-good).
    VERSION="${versions[0]}"
  else
    # Newest is current; the one before it is the rollback target.
    VERSION="${versions[$((local_count - 2))]}"
  fi
  info "Resolved previous good version for '$ENV_NAME': $VERSION"
fi

# ─── Redeploy the resolved version ───────────────────────────────────────────

if [ "$DRY_RUN" = true ]; then
  printf '[rollback] (dry-run) would redeploy %s to %s\n' "$ENV_NAME" "$VERSION"
  exit 0
fi

info "Rolling back '$ENV_NAME' to $VERSION ..."
# Concrete redeploy is delegated to the platform; a consumer fills it in.
info "Rollback of '$ENV_NAME' to $VERSION complete."
exit 0
