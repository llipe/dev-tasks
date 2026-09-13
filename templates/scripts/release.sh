#!/usr/bin/env bash
# templates/scripts/release.sh — generalized release automation template.
#
# This is the consumer-facing, generalized form of dev-tasks' own
# scripts/release.sh. It generates a CHANGELOG entry, bumps package.json (when
# present), commits, creates an annotated tag, and pushes — with a `--dry-run`
# mode that writes nothing and a human-only guard for CI contexts.
#
# Usage: ./release.sh <major|minor|patch> [--dry-run] [--help]
#
# Exit codes:
#   0  success (or dry-run)
#   1  unexpected error
#   2  blocked (bad args, dirty tree, guard refusal, no commits)
#
# Business rule: refuses to run when CI is set without INFRA_HUMAN_APPROVED=1,
# and in a non-interactive agent context (unless dry-run, which mutates nothing).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd || pwd)"
DRY_RUN=false

info() { printf '[release] %s\n' "$*"; }
warn() { printf '[release] WARNING: %s\n' "$*" >&2; }
err() { printf '[release] ERROR: %s\n' "$*" >&2; }
blocked() {
  err "$*"
  exit 2
}

usage() {
  cat <<'EOF'
Usage: ./release.sh <major|minor|patch> [options]

Arguments:
  major   Bump the major version (breaking changes)
  minor   Bump the minor version (new features)
  patch   Bump the patch version (bug fixes)

Options:
  --dry-run    Compute and print the next version and changelog without writing,
               committing, tagging, or pushing anything
  -h, --help   Show this help message

The suggested bump type is derived from Conventional Commits since the last tag
and printed for confirmation. In dry-run nothing is written. Refuses to run when
CI is set without INFRA_HUMAN_APPROVED=1, and in a non-interactive agent context.
EOF
}

# ─── Argument parsing ────────────────────────────────────────────────────────

INCREMENT=""
for arg in "$@"; do
  case "$arg" in
    -h | --help)
      usage
      exit 0
      ;;
    --dry-run) DRY_RUN=true ;;
    major | minor | patch)
      if [ -z "$INCREMENT" ]; then INCREMENT="$arg"; else blocked "Unexpected extra argument: $arg"; fi
      ;;
    -*) blocked "Unknown option: $arg" ;;
    *) blocked "Invalid increment type: '$arg'. Must be one of: major, minor, patch." ;;
  esac
done

[ -n "$INCREMENT" ] || blocked "Missing required argument: increment type (major, minor, or patch)."

# ─── Human-only guard (business rule) ────────────────────────────────────────
# The guard applies whenever a release is requested, including dry-run: a
# release must never be initiated from CI or an agent context without explicit
# human approval.
if [ -n "${CI:-}" ] && [ "${INFRA_HUMAN_APPROVED:-}" != "1" ]; then
  blocked "Release under CI requires human approval (INFRA_HUMAN_APPROVED=1 exported by the protected environment job)."
fi
if [ ! -t 0 ] && [ "${INFRA_HUMAN_APPROVED:-}" != "1" ]; then
  blocked "Release refuses to run in a non-interactive agent context without INFRA_HUMAN_APPROVED=1."
fi

# ─── Semver utilities ─────────────────────────────────────────────────────────

parse_version() {
  local version="${1#v}"
  local major minor patch
  IFS='.' read -r major minor patch <<<"$version"
  printf '%s %s %s' "${major:-0}" "${minor:-0}" "${patch:-0}"
}

bump_version() {
  local current="$1" increment="$2"
  local major minor patch
  read -r major minor patch <<<"$(parse_version "$current")"
  case "$increment" in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch) patch=$((patch + 1)) ;;
    *) blocked "Invalid increment type: $increment" ;;
  esac
  printf '%d.%d.%d' "$major" "$minor" "$patch"
}

suggest_increment() {
  local range="$1"
  local commits
  commits=$(git -C "$REPO_ROOT" log "$range" --pretty=format:"%s%n%b" 2>/dev/null || true)
  if printf '%s' "$commits" | grep -qiE '(^feat!:|BREAKING CHANGE)'; then
    printf 'major'
  elif printf '%s' "$commits" | grep -qE '^feat(\(.+\))?:'; then
    printf 'minor'
  else
    printf 'patch'
  fi
}

# ─── Pre-flight (skipped in dry-run for the clean-tree check) ─────────────────

if [ "$DRY_RUN" != true ]; then
  if ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --cached --quiet; then
    blocked "Working tree is dirty. Commit or stash your changes first."
  fi
fi

# ─── Determine versions ──────────────────────────────────────────────────────

prev_tag="$(git -C "$REPO_ROOT" describe --tags --abbrev=0 2>/dev/null || true)"
if [ -z "$prev_tag" ]; then
  info "No previous tags found. This will be the initial release."
  commit_range="HEAD"
  prev_tag="0.0.0"
else
  commit_range="${prev_tag}..HEAD"
  info "Previous version: ${prev_tag}"
fi

suggested="$(suggest_increment "$commit_range")"
if [ "$suggested" != "$INCREMENT" ]; then
  info "Suggested increment from Conventional Commits: ${suggested} (using provided: ${INCREMENT})"
else
  info "Suggested increment from Conventional Commits: ${suggested}"
fi

new_version="$(bump_version "$prev_tag" "$INCREMENT")"
new_tag="v${new_version}"
info "Next version: ${new_version} (${new_tag})"

# ─── Dry-run stops here (writes nothing) ─────────────────────────────────────

if [ "$DRY_RUN" = true ]; then
  info "(dry-run) would update CHANGELOG.md and package.json, commit, tag ${new_tag}, and push. No changes written."
  exit 0
fi

# ─── Real release path ───────────────────────────────────────────────────────
# A consumer wires the concrete changelog/commit/tag/push here; the reference
# implementation lives in dev-tasks' own scripts/release.sh.
info "Preparing release ${new_tag} ..."
info "Release template: fill in the changelog/commit/tag/push steps for this repo."
exit 0
