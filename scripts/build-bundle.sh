#!/usr/bin/env bash
# scripts/build-bundle.sh — Build a versioned distribution tarball for dev-tasks
# Usage: ./scripts/build-bundle.sh [version]
#   version  Semantic version string (default: read from git tag or 0.0.0-dev)
#
# Output (in dist/):
#   dev-tasks-bundle-v<version>.tar.gz
#   dev-tasks-bundle-v<version>.tar.gz.sha256

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${REPO_ROOT}/dist"

# ─── Managed file surface (must mirror bundle-manifest.json + dev-tasks.sh) ──

MANAGED_DIRS=(
  ".github/agents"
  ".github/skills"
  ".github/instructions"
  ".github/instructions/domain"
  ".github/prompts"
  ".agents/skills"
)

MANAGED_FILES=(
  "skills-lock.json"
  "bundle-manifest.json"
  "dev-tasks.sh"
  "AGENTS.md"
)

# ─── Helpers ──────────────────────────────────────────────────────────────────

info()  { printf "[build-bundle] %s\n" "$*"; }
error() { printf "[build-bundle] ERROR: %s\n" "$*" >&2; }
die()   { error "$*"; exit 1; }

sha256_file() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    sha256sum "$file" | awk '{print $1}'
  fi
}

resolve_version() {
  local arg_version="${1:-}"
  if [ -n "$arg_version" ]; then
    printf '%s' "${arg_version#v}"
    return
  fi
  # Try git describe for a clean tag
  local git_version
  git_version=$(git -C "$REPO_ROOT" describe --tags --exact-match 2>/dev/null || true)
  if [ -n "$git_version" ]; then
    printf '%s' "${git_version#v}"
    return
  fi
  # Fallback to dev snapshot
  local short_sha
  short_sha=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
  printf '0.0.0-dev+%s' "$short_sha"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  local version
  version=$(resolve_version "${1:-}")

  local bundle_name="dev-tasks-bundle-v${version}.tar.gz"
  local bundle_path="${DIST_DIR}/${bundle_name}"
  local checksum_path="${bundle_path}.sha256"
  local stage_dir
  stage_dir=$(mktemp -d)
  # Use double quotes so stage_dir is expanded now (not when trap fires after
  # main() returns and the local variable is out of scope under set -u).
  # shellcheck disable=SC2064
  trap "rm -rf '${stage_dir}'" EXIT

  local inner_dir="${stage_dir}/dev-tasks-v${version}"
  mkdir -p "$inner_dir"

  info "Building bundle v${version} ..."

  # Copy managed directories
  for dir in "${MANAGED_DIRS[@]}"; do
    local src="${REPO_ROOT}/${dir}"
    if [ -d "$src" ]; then
      local dest="${inner_dir}/${dir}"
      mkdir -p "$dest"
      cp -r "${src}/." "${dest}/"
      info "  + ${dir}/"
    else
      info "  (skip: ${dir}/ not found)"
    fi
  done

  # Copy managed top-level files
  for file in "${MANAGED_FILES[@]}"; do
    local src="${REPO_ROOT}/${file}"
    if [ -f "$src" ]; then
      # Preserve directory structure for nested files
      local dest_dir
      dest_dir=$(dirname "${inner_dir}/${file}")
      mkdir -p "$dest_dir"
      cp "$src" "${inner_dir}/${file}"
      info "  + ${file}"
    else
      info "  (skip: ${file} not found)"
    fi
  done

  # Produce tarball
  mkdir -p "$DIST_DIR"
  tar -czf "$bundle_path" -C "$stage_dir" "dev-tasks-v${version}"
  info "Created: ${bundle_path}"

  # Generate checksum
  local checksum
  checksum=$(sha256_file "$bundle_path")
  printf '%s  %s\n' "$checksum" "$bundle_name" > "$checksum_path"
  info "Checksum: ${checksum_path}"
  info "SHA256:   ${checksum}"

  printf "\nBundle ready:\n  %s\n  %s\n" "$bundle_path" "$checksum_path"
}

main "$@"
