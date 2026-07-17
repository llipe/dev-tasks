#!/usr/bin/env bash
# scripts/release.sh — Automate release: generate CHANGELOG, commit, tag, push.
#
# Usage: ./scripts/release.sh <major|minor|patch>
#
# Pre-flight checks:
#   - Must be on the main branch
#   - Working tree must be clean
#   - scripts/format.sh --check must pass
#
# The script:
#   1. Determines the previous version tag (or treats all history as initial)
#   2. Computes the next semver version based on the provided increment type
#   3. Suggests an increment based on commit analysis (informational only)
#   4. Generates a CHANGELOG.md entry grouped by Conventional Commit type
#   5. Commits the CHANGELOG.md update
#   6. Creates an annotated git tag
#   7. Pushes the tag to origin (triggering release-bundle.yml)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ─── Helpers ──────────────────────────────────────────────────────────────────

info()    { printf "[release] %s\n" "$*"; }
warn()    { printf "[release] WARNING: %s\n" "$*" >&2; }
error()   { printf "[release] ERROR: %s\n" "$*" >&2; }
die()     { error "$*"; exit 1; }

usage() {
  cat <<'EOF'
Usage: ./scripts/release.sh <major|minor|patch>

Arguments:
  major   Bump the major version (breaking changes)
  minor   Bump the minor version (new features)
  patch   Bump the patch version (bug fixes)

Options:
  -h, --help   Show this help message

The script generates a CHANGELOG.md entry, commits it, creates an annotated
git tag, and pushes the tag to trigger the release-bundle.yml workflow.
EOF
}

# ─── Semver Utilities ─────────────────────────────────────────────────────────

# Parse a version string like "1.2.3" into components
parse_version() {
  local version="${1#v}"
  local major minor patch
  IFS='.' read -r major minor patch <<< "$version"
  printf '%s %s %s' "${major:-0}" "${minor:-0}" "${patch:-0}"
}

# Bump version given current version and increment type
bump_version() {
  local current="$1" increment="$2"
  local major minor patch
  read -r major minor patch <<< "$(parse_version "$current")"

  case "$increment" in
    major) major=$((major + 1)); minor=0; patch=0 ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    patch) patch=$((patch + 1)) ;;
    *) die "Invalid increment type: $increment" ;;
  esac

  printf '%d.%d.%d' "$major" "$minor" "$patch"
}

# ─── Pre-flight Checks ───────────────────────────────────────────────────────

preflight_branch() {
  local branch
  branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)
  if [ "$branch" != "main" ]; then
    die "Must be on the 'main' branch (currently on '$branch')."
  fi
}

preflight_clean_tree() {
  if ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --cached --quiet; then
    die "Working tree is dirty. Commit or stash your changes first."
  fi
  # Also check for untracked files that would be problematic
  if [ -n "$(git -C "$REPO_ROOT" ls-files --others --exclude-standard)" ]; then
    die "Untracked files present. Commit, stash, or .gitignore them first."
  fi
}

preflight_format() {
  info "Running format check ..."
  if ! "$REPO_ROOT/scripts/format.sh" --check; then
    die "Format check failed. Run './scripts/format.sh --write' to fix, then retry."
  fi
  info "Format check passed."
}

# ─── gh CLI Utilities ─────────────────────────────────────────────────────────

GH_AVAILABLE=false

check_gh_cli() {
  if ! command -v gh >/dev/null 2>&1; then
    warn "gh CLI not found. PR metadata will not be included in the changelog."
    return
  fi
  if ! gh auth status >/dev/null 2>&1; then
    warn "gh CLI not authenticated. PR metadata will not be included in the changelog."
    return
  fi
  GH_AVAILABLE=true
}

# ─── Commit Analysis ─────────────────────────────────────────────────────────

# Suggest an increment based on commit messages since the last tag
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

# ─── Changelog Generation ────────────────────────────────────────────────────

generate_changelog_entry() {
  local version="$1" date="$2" range="$3"
  local features="" fixes="" other=""

  # Collect commits grouped by type
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    if printf '%s' "$line" | grep -qE '^feat(\(.+\))?!?:'; then
      features="${features}- ${line}
"
    elif printf '%s' "$line" | grep -qE '^fix(\(.+\))?:'; then
      fixes="${fixes}- ${line}
"
    else
      other="${other}- ${line}
"
    fi
  done <<< "$(git -C "$REPO_ROOT" log "$range" --pretty=format:"%s" 2>/dev/null)"

  # Collect merged PR info if gh is available
  local pr_section=""
  if [ "$GH_AVAILABLE" = true ]; then
    local prev_tag_date=""
    # Get the date of the previous tag to filter PRs
    local prev_tag="${range%%\.\.*}"
    if [ "$prev_tag" != "" ] && git -C "$REPO_ROOT" rev-parse "$prev_tag" >/dev/null 2>&1; then
      prev_tag_date=$(git -C "$REPO_ROOT" log -1 --format="%aI" "$prev_tag" 2>/dev/null || true)
    fi

    local pr_data=""
    if [ -n "$prev_tag_date" ]; then
      pr_data=$(cd "$REPO_ROOT" && gh pr list --state merged --base main --json title,number,body --limit 100 2>/dev/null | \
        grep -o '"title":"[^"]*"\|"number":[0-9]*' 2>/dev/null || true)
    else
      pr_data=$(cd "$REPO_ROOT" && gh pr list --state merged --base main --json title,number --limit 100 2>/dev/null | \
        grep -o '"title":"[^"]*"\|"number":[0-9]*' 2>/dev/null || true)
    fi

    if [ -n "$pr_data" ]; then
      # Parse PR titles into the appropriate sections
      while IFS= read -r pr_line; do
        local pr_title=""
        local pr_num=""
        if [[ "$pr_line" =~ \"title\":\"([^\"]+)\" ]]; then
          pr_title="${BASH_REMATCH[1]}"
        fi
        if [[ "$pr_line" =~ \"number\":([0-9]+) ]]; then
          pr_num="${BASH_REMATCH[1]}"
        fi
        if [ -n "$pr_title" ] && [ -n "$pr_num" ]; then
          local pr_entry="- ${pr_title} (#${pr_num})"
          if printf '%s' "$pr_title" | grep -qE '^feat(\(.+\))?!?:'; then
            features="${features}${pr_entry}
"
          elif printf '%s' "$pr_title" | grep -qE '^fix(\(.+\))?:'; then
            fixes="${fixes}${pr_entry}
"
          fi
        fi
      done <<< "$pr_data"
    fi
  fi

  # Build the entry
  local entry="## [${version}] - ${date}
"

  if [ -n "$features" ]; then
    entry="${entry}
### Added

${features}"
  fi

  if [ -n "$fixes" ]; then
    entry="${entry}
### Fixed

${fixes}"
  fi

  if [ -n "$other" ]; then
    entry="${entry}
### Changed

${other}"
  fi

  printf '%s' "$entry"
}

# ─── CHANGELOG.md File Management ────────────────────────────────────────────

CHANGELOG_FILE="${REPO_ROOT}/CHANGELOG.md"
CHANGELOG_HEADER="# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).
"

ensure_changelog_exists() {
  if [ ! -f "$CHANGELOG_FILE" ]; then
    info "Creating CHANGELOG.md ..."
    printf '%s\n' "$CHANGELOG_HEADER" > "$CHANGELOG_FILE"
  fi
}

insert_changelog_entry() {
  local entry="$1"
  local tmp_file
  tmp_file=$(mktemp)

  if grep -q "^## \[" "$CHANGELOG_FILE" 2>/dev/null; then
    # Insert before the first existing version entry
    local inserted=false
    while IFS= read -r line; do
      if [ "$inserted" = false ] && printf '%s' "$line" | grep -q "^## \["; then
        printf '%s\n\n' "$entry" >> "$tmp_file"
        inserted=true
      fi
      printf '%s\n' "$line" >> "$tmp_file"
    done < "$CHANGELOG_FILE"
    if [ "$inserted" = false ]; then
      printf '\n%s\n' "$entry" >> "$tmp_file"
    fi
  else
    # No existing entries — append after header
    cat "$CHANGELOG_FILE" > "$tmp_file"
    printf '\n%s\n' "$entry" >> "$tmp_file"
  fi

  mv "$tmp_file" "$CHANGELOG_FILE"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  # Parse arguments
  case "${1:-}" in
    -h|--help) usage; exit 0 ;;
    major|minor|patch) ;;
    "")  die "Missing required argument: increment type (major, minor, or patch). Use --help for usage." ;;
    *)   die "Invalid increment type: '$1'. Must be one of: major, minor, patch." ;;
  esac

  local increment="$1"

  # Pre-flight checks
  info "Running pre-flight checks ..."
  preflight_branch
  preflight_clean_tree
  preflight_format

  # Check gh CLI availability
  check_gh_cli

  # Determine previous version
  local prev_tag=""
  local commit_range=""
  prev_tag=$(git -C "$REPO_ROOT" describe --tags --abbrev=0 2>/dev/null || true)

  if [ -z "$prev_tag" ]; then
    info "No previous tags found. This will be the initial release."
    commit_range="HEAD"
    prev_tag="0.0.0"
  else
    commit_range="${prev_tag}..HEAD"
    info "Previous version: ${prev_tag}"
  fi

  # Check there are commits to release
  local commit_count
  if [ "$commit_range" = "HEAD" ]; then
    commit_count=$(git -C "$REPO_ROOT" rev-list HEAD --count 2>/dev/null || echo "0")
  else
    commit_count=$(git -C "$REPO_ROOT" rev-list "$commit_range" --count 2>/dev/null || echo "0")
  fi

  if [ "$commit_count" = "0" ]; then
    die "No commits found since ${prev_tag}. Nothing to release."
  fi

  # Suggest increment
  local log_range
  if [ "$commit_range" = "HEAD" ]; then
    log_range="HEAD"
  else
    log_range="${commit_range}"
  fi
  local suggested
  suggested=$(suggest_increment "$log_range")
  if [ "$suggested" != "$increment" ]; then
    info "Suggested increment based on commit analysis: ${suggested} (using provided: ${increment})"
  fi

  # Compute new version
  local new_version
  new_version=$(bump_version "$prev_tag" "$increment")
  local new_tag="v${new_version}"

  # Check if tag already exists
  if git -C "$REPO_ROOT" rev-parse "$new_tag" >/dev/null 2>&1; then
    die "Tag '${new_tag}' already exists. Choose a different increment or remove the existing tag."
  fi

  info "New version: ${new_version} (${new_tag})"

  # Generate changelog entry
  local today
  today=$(date +%Y-%m-%d)
  local changelog_entry
  changelog_entry=$(generate_changelog_entry "$new_version" "$today" "$log_range")

  # Write changelog
  ensure_changelog_exists
  insert_changelog_entry "$changelog_entry"
  info "Updated CHANGELOG.md"

  # Commit changelog
  git -C "$REPO_ROOT" add CHANGELOG.md
  git -C "$REPO_ROOT" commit -m "docs: update CHANGELOG for ${new_tag}"
  info "Committed CHANGELOG.md"

  # Create annotated tag
  git -C "$REPO_ROOT" tag -a "$new_tag" -m "Release ${new_tag}"
  info "Created tag: ${new_tag}"

  # Push tag
  git -C "$REPO_ROOT" push origin "$new_tag"
  info "Pushed tag: ${new_tag}"

  # Summary
  printf '\n'
  info "╔══════════════════════════════════════════════╗"
  info "║           Release Complete                   ║"
  info "╠══════════════════════════════════════════════╣"
  info "║  Version:  %-32s ║" "${new_version}"
  info "║  Tag:      %-32s ║" "${new_tag}"
  info "║  Commits:  %-32s ║" "${commit_count} since ${prev_tag}"
  info "╚══════════════════════════════════════════════╝"
  printf '\n'
  info "The tag push will trigger the release-bundle.yml workflow."
  info "Check CI: https://github.com/llipe/dev-tasks/actions"
}

main "$@"
