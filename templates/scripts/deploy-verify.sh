#!/usr/bin/env bash
# templates/scripts/deploy-verify.sh — post-deploy health verification.
#
# Runs the environment's health check(s). On failure it exits 3 and prints the
# exact rollback invocation the operator (or a CI job) should run next.
#
# Usage: ./deploy-verify.sh <env> [--help]
#
# Exit codes:
#   0  healthy
#   2  blocked (bad args, missing/template env file, unknown env)
#   3  health check failed (prints `rollback.sh <env>`)
#
# Environment overrides:
#   INFRA_ENV_FILE           path to the environments file
#   INFRA_VERIFY_FORCE_FAIL  test hook: 1 forces the health check to fail
#   INFRA_STUB_LOG           test hook: argv log path

set -euo pipefail

ENV_FILE="${INFRA_ENV_FILE:-infra/environments.yaml}"

info() { printf '[deploy-verify] %s\n' "$*"; }
err() { printf '[deploy-verify] ERROR: %s\n' "$*" >&2; }
blocked() {
  err "$*"
  exit 2
}

usage() {
  cat <<'EOF'
Usage: ./deploy-verify.sh <env> [--help]

Runs the health check for <env>. Exit 0 healthy; exit 3 on failure, printing the
exact `rollback.sh <env>` invocation to run next; exit 2 on blocked conditions.
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

# Environment file is required for a real check; tolerate absence only when a
# test hook forces the outcome, so the failure path is exercisable in isolation.
if [ "${INFRA_VERIFY_FORCE_FAIL:-}" != "1" ]; then
  command -v yq >/dev/null 2>&1 || blocked "yq (4.x) not found on PATH."
  [ -f "$ENV_FILE" ] || blocked "Environment file not found: $ENV_FILE"
  if head -1 "$ENV_FILE" | grep -q '# status: template'; then
    blocked "Environment file $ENV_FILE is a template; fill it before verifying."
  fi
  if [ "$(yq -r ".environments | has(\"$ENV_NAME\")" "$ENV_FILE")" != "true" ]; then
    blocked "Unknown environment '$ENV_NAME' in $ENV_FILE"
  fi
fi

info "Verifying health of '$ENV_NAME' ..."

# The concrete health probe is environment-specific; a consumer fills it in.
# The test hook forces the failure branch so the rollback contract is covered.
health_ok=true
if [ "${INFRA_VERIFY_FORCE_FAIL:-}" = "1" ]; then
  health_ok=false
fi

if [ "$health_ok" != true ]; then
  err "Health check failed for '$ENV_NAME'."
  # AC-5: print the exact rollback invocation.
  printf '[deploy-verify] Roll back with: rollback.sh %s\n' "$ENV_NAME"
  exit 3
fi

info "Health check passed for '$ENV_NAME'."
exit 0
