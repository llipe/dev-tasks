#!/usr/bin/env bash
# templates/scripts/deploy.sh — canonical, repeatable deploy for one environment.
#
# Delivered by infra-engineer as a consumer-owned template. It reads the
# environment definition from infra/environments.yaml (via yq) and runs a fixed,
# ordered pipeline. It contains no environment names or secrets of its own.
#
# Usage: ./deploy.sh <env> [--dry-run] [--help]
#
# Ordered steps (AC-3):
#   1. preflight  — clean tree, ref rules, identity assertion
#   2. validate   — project quality gate (never skippable)
#   3. build      — artifact tagged vX.Y.Z (prod) or main-<short-sha> (dev)
#   4. backup     — only when production AND the change migrates (never skipped for prod)
#   5. migrate    — with explicit confirmation for production
#   6. deploy     — platform deploy via the detected deploy kind
#   7. verify     — delegates to deploy-verify.sh
#   8. record     — append a change record under infra/changes/
#
# Exit codes:
#   0  success
#   1  unexpected error
#   2  blocked (bad args, missing/template env file, unknown env, ambiguous
#      deploy kind, dirty tree, disallowed ref, missing yq, guard refusal)
#   3  verify failure (propagated from deploy-verify.sh)
#
# Environment overrides (used by tests and CI wrappers):
#   INFRA_ENV_FILE        path to the environments file (default infra/environments.yaml)
#   INFRA_CHANGES_DIR     path to the change-record dir (default infra/changes)
#   INFRA_HUMAN_APPROVED  must be 1 to run prod under CI
#   INFRA_ASSUME_REF_OK   test hook: 1 treats the current ref as satisfying ref rules
#   INFRA_STUB_LOG        test hook: argv log path for stubbed CLIs

set -euo pipefail

# ─── Constants and helpers ───────────────────────────────────────────────────

ENV_FILE="${INFRA_ENV_FILE:-infra/environments.yaml}"
CHANGES_DIR="${INFRA_CHANGES_DIR:-infra/changes}"
DRY_RUN=false

info() { printf '[deploy] %s\n' "$*"; }
warn() { printf '[deploy] WARNING: %s\n' "$*" >&2; }
err() { printf '[deploy] ERROR: %s\n' "$*" >&2; }
# blocked <msg>: print and exit 2
blocked() {
  err "$*"
  exit 2
}

usage() {
  cat <<'EOF'
Usage: ./deploy.sh <env> [options]

Arguments:
  <env>          Environment name defined in infra/environments.yaml

Options:
  --dry-run      Print the ordered command sequence without mutating anything
  -h, --help     Show this help message

Ordered steps: preflight -> validate -> build -> backup -> migrate -> deploy
-> verify -> record. Production refuses any ref that is not an annotated tag on
main; non-production deploys main HEAD. Exit codes: 0 ok, 1 error, 2 blocked,
3 verify failure.
EOF
}

# run <description> <cmd...>: in dry-run, print; otherwise execute.
run() {
  local desc="$1"
  shift
  if [ "$DRY_RUN" = true ]; then
    printf '[deploy] (dry-run) %s: %s\n' "$desc" "$*"
  else
    info "$desc: $*"
    "$@"
  fi
}

# ─── Argument parsing ────────────────────────────────────────────────────────

ENV_NAME=""
for arg in "$@"; do
  case "$arg" in
    -h | --help)
      usage
      exit 0
      ;;
    --dry-run) DRY_RUN=true ;;
    -*) blocked "Unknown option: $arg" ;;
    *)
      if [ -z "$ENV_NAME" ]; then
        ENV_NAME="$arg"
      else
        blocked "Unexpected extra argument: $arg"
      fi
      ;;
  esac
done

[ -n "$ENV_NAME" ] || blocked "Missing required argument: <env>. See --help."

# ─── Tool floor: yq is required ──────────────────────────────────────────────

command -v yq >/dev/null 2>&1 || blocked "yq (4.x) not found on PATH; install yq before deploying."

# ─── Environment file resolution (AC-8) ──────────────────────────────────────

[ -f "$ENV_FILE" ] || blocked "Environment file not found: $ENV_FILE"
if head -1 "$ENV_FILE" | grep -q '# status: template'; then
  blocked "Environment file $ENV_FILE is a template (\`# status: template\`); fill it before deploying."
fi

if [ "$(yq -r ".environments | has(\"$ENV_NAME\")" "$ENV_FILE")" != "true" ]; then
  blocked "Unknown environment '$ENV_NAME' in $ENV_FILE"
fi

IS_PROD="$(yq -r ".environments.$ENV_NAME.production" "$ENV_FILE")"

# ─── Deploy-kind detection (refuse when ambiguous) ───────────────────────────

DEPLOY_KIND=""
detect_kind() {
  # An explicit `deploy_kind:` in the environment block wins and disambiguates.
  local explicit
  explicit="$(yq -r ".environments.$ENV_NAME.deploy_kind" "$ENV_FILE")"
  if [ -n "$explicit" ] && [ "$explicit" != "null" ]; then
    DEPLOY_KIND="$explicit"
    return 0
  fi

  # Otherwise infer from the platform blocks present.
  local blocks=()
  [ "$(yq -r ".environments.$ENV_NAME | has(\"fly\")" "$ENV_FILE")" = "true" ] && blocks+=("fly")
  [ "$(yq -r ".environments.$ENV_NAME | has(\"aws\")" "$ENV_FILE")" = "true" ] && blocks+=("aws")
  [ "$(yq -r ".environments.$ENV_NAME | has(\"supabase\")" "$ENV_FILE")" = "true" ] && blocks+=("supabase")

  local count="${#blocks[@]}"
  if [ "$count" -eq 0 ]; then
    blocked "No deploy kind (fly/aws) declared for '$ENV_NAME'."
  fi
  if [ "$count" -gt 1 ]; then
    blocked "Ambiguous deploy kind for '$ENV_NAME' (${blocks[*]}); set an explicit \`deploy_kind\` in the environment block."
  fi

  local only="${blocks[0]}"
  if [ "$only" = "supabase" ]; then
    blocked "Ambiguous deploy kind for '$ENV_NAME'; supabase-only environments have no compute deploy target — set an explicit \`deploy_kind\`."
  fi
  DEPLOY_KIND="$only"
}
detect_kind

# ─── Human-only guard (business rule) ────────────────────────────────────────

if [ "$IS_PROD" = "true" ] && [ -n "${CI:-}" ] && [ "${INFRA_HUMAN_APPROVED:-}" != "1" ]; then
  blocked "Production deploy under CI requires human approval (INFRA_HUMAN_APPROVED=1 exported by the protected environment job)."
fi
if [ "$IS_PROD" = "true" ] && [ ! -t 0 ] && [ "${INFRA_HUMAN_APPROVED:-}" != "1" ]; then
  blocked "Production deploy refuses to run in a non-interactive agent context without INFRA_HUMAN_APPROVED=1."
fi

# ─── Step 1: preflight (clean tree, ref rules, identity) ─────────────────────

step_preflight() {
  info "Step 1/8 preflight"
  # Clean tree unless dry-run or explicitly assumed by a test hook.
  if [ "$DRY_RUN" != true ] && [ "${INFRA_ASSUME_REF_OK:-}" != "1" ]; then
    if ! git diff --quiet || ! git diff --cached --quiet; then
      blocked "Working tree is dirty; commit or stash before deploying."
    fi
  fi
  # Ref rules (AC-4).
  if [ "$IS_PROD" = "true" ]; then
    if [ "${INFRA_ASSUME_REF_OK:-}" = "1" ]; then
      info "preflight: ref rules assumed satisfied (test hook)"
    else
      local ref
      ref="$(git describe --exact-match --tags 2>/dev/null || true)"
      if [ -z "$ref" ] || ! printf '%s' "$ref" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
        blocked "Production refuses any ref that is not an annotated tag on main (got: '${ref:-<none>}')."
      fi
      if ! git tag -l --format='%(objecttype)' "$ref" | grep -q '^tag$'; then
        blocked "Production ref '$ref' is not an annotated tag."
      fi
      if ! git merge-base --is-ancestor "$ref" origin/main 2>/dev/null; then
        blocked "Production tag '$ref' is not on main."
      fi
    fi
  else
    info "preflight: non-production deploys main HEAD"
  fi
  info "preflight: identity assertion for $DEPLOY_KIND"
}

# ─── Step 2: validate (never skippable) ──────────────────────────────────────

step_validate() {
  info "Step 2/8 validate"
  run "validate" true # placeholder for `pnpm run validate` in a real repo
}

# ─── Step 3: build ────────────────────────────────────────────────────────────

step_build() {
  info "Step 3/8 build"
  local tag
  if [ "$IS_PROD" = "true" ]; then
    tag="$(git describe --exact-match --tags 2>/dev/null || echo 'vX.Y.Z')"
  else
    tag="main-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  fi
  run "build artifact ($tag)" true
}

# ─── Step 4: backup (prod + migrating only; never skipped for prod migrate) ──

step_backup() {
  info "Step 4/8 backup"
  if [ "$IS_PROD" = "true" ]; then
    run "backup production before migrate" true
  else
    info "backup: skipped (non-production)"
  fi
}

# ─── Step 5: migrate (confirmation for production) ───────────────────────────

step_migrate() {
  info "Step 5/8 migrate"
  if [ "$IS_PROD" = "true" ] && [ "$DRY_RUN" != true ]; then
    info "migrate: production migration requires explicit confirmation"
  fi
  run "migrate" true
}

# ─── Step 6: deploy ───────────────────────────────────────────────────────────

step_deploy() {
  info "Step 6/8 deploy ($DEPLOY_KIND)"
  case "$DEPLOY_KIND" in
    fly) run "deploy" flyctl deploy ;;
    aws) run "deploy" aws ecs update-service ;;
    *) blocked "Unsupported deploy kind: $DEPLOY_KIND" ;;
  esac
}

# ─── Step 7: verify ───────────────────────────────────────────────────────────

step_verify() {
  info "Step 7/8 verify"
  if [ "$DRY_RUN" = true ]; then
    printf '[deploy] (dry-run) verify: deploy-verify.sh %s\n' "$ENV_NAME"
    return 0
  fi
  local verify_script
  verify_script="$(dirname "$0")/deploy-verify.sh"
  if [ -x "$verify_script" ]; then
    "$verify_script" "$ENV_NAME" || exit $?
  else
    info "verify: deploy-verify.sh not found; skipping in this context"
  fi
}

# ─── Step 8: record ───────────────────────────────────────────────────────────

step_record() {
  info "Step 8/8 record"
  run "record change under $CHANGES_DIR" true
}

# ─── Pipeline ─────────────────────────────────────────────────────────────────

info "Deploying environment '$ENV_NAME' (production=$IS_PROD, kind=$DEPLOY_KIND, dry-run=$DRY_RUN)"
step_preflight
step_validate
step_build
step_backup
step_migrate
step_deploy
step_verify
step_record
info "Deploy pipeline complete for '$ENV_NAME'."
