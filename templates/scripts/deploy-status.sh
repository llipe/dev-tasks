#!/usr/bin/env bash
# templates/scripts/deploy-status.sh — read-only status of an environment.
#
# Reports the current deployed version and platform status. It performs no
# mutations and issues only read-only platform queries.
#
# Usage: ./deploy-status.sh <env> [--help]
#
# Exit codes:
#   0  status reported
#   2  blocked (bad args, missing/template env file, unknown env, missing yq)
#
# Environment overrides:
#   INFRA_ENV_FILE     path to the environments file
#   INFRA_CHANGES_DIR  path to the change-record dir (default infra/changes)
#   INFRA_STUB_LOG     test hook: argv log path

set -euo pipefail

ENV_FILE="${INFRA_ENV_FILE:-infra/environments.yaml}"
CHANGES_DIR="${INFRA_CHANGES_DIR:-infra/changes}"

info() { printf '[deploy-status] %s\n' "$*"; }
err() { printf '[deploy-status] ERROR: %s\n' "$*" >&2; }
blocked() {
  err "$*"
  exit 2
}

usage() {
  cat <<'EOF'
Usage: ./deploy-status.sh <env> [--help]

Read-only. Reports the last recorded version and issues read-only platform
status queries for <env>. Exit codes: 0 ok, 2 blocked.
EOF
}

ENV_NAME=""
for arg in "$@"; do
  case "$arg" in
    -h | --help)
      usage
      exit 0
      ;;
    -*) blocked "Unknown option: $arg" ;;
    *)
      if [ -z "$ENV_NAME" ]; then ENV_NAME="$arg"; else blocked "Unexpected extra argument: $arg"; fi
      ;;
  esac
done

[ -n "$ENV_NAME" ] || blocked "Missing required argument: <env>. See --help."

command -v yq >/dev/null 2>&1 || blocked "yq (4.x) not found on PATH."
[ -f "$ENV_FILE" ] || blocked "Environment file not found: $ENV_FILE"
if head -1 "$ENV_FILE" | grep -q '# status: template'; then
  blocked "Environment file $ENV_FILE is a template; fill it before querying status."
fi
if [ "$(yq -r ".environments | has(\"$ENV_NAME\")" "$ENV_FILE")" != "true" ]; then
  blocked "Unknown environment '$ENV_NAME' in $ENV_FILE"
fi

info "Status for environment '$ENV_NAME':"

# Last recorded version, if any (read-only).
if [ -d "$CHANGES_DIR" ]; then
  last_rec="$(find "$CHANGES_DIR" -maxdepth 1 -type f -name "*-${ENV_NAME}-*.md" | sort | tail -1)"
  if [ -n "$last_rec" ]; then
    v="$(grep '^version:' "$last_rec" | head -1 | sed -E 's/^version:[[:space:]]*//')"
    info "  last recorded version: ${v:-unknown}"
  else
    info "  no recorded change history for '$ENV_NAME'"
  fi
else
  info "  no change directory ($CHANGES_DIR)"
fi

# Read-only platform probes (deploy kind inferred from present blocks).
if [ "$(yq -r ".environments.$ENV_NAME | has(\"fly\")" "$ENV_FILE")" = "true" ]; then
  info "  querying fly status (read-only)"
  flyctl status >/dev/null 2>&1 || true
fi
if [ "$(yq -r ".environments.$ENV_NAME | has(\"aws\")" "$ENV_FILE")" = "true" ]; then
  info "  querying aws status (read-only)"
  aws sts get-caller-identity >/dev/null 2>&1 || true
fi

exit 0
