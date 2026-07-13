#!/usr/bin/env bash
# dev-tasks.sh — Single-script installer and updater for the dev-tasks agent toolkit
# Source: https://github.com/llipe/dev-tasks
# Usage:  ./dev-tasks.sh <command> [options]
#
# Commands:
#   install     [version]  Install the toolkit (latest or pinned version)
#   update      [version]  Update to the latest or a specific version
#   self-update [version]  Update only the dev-tasks.sh script itself
#   check                  Compare installed vs latest version
#   version                Print installed version info
#
# Options (install / update / self-update):
#   --dry-run          Show what would change without writing any files
#   --backup           Back up managed files before replacing them
#   --yes              Skip confirmation prompts
#   --profile <name>   Select file set: copilot | claude | kiro | both | all, or a comma-separated
#                       combination (e.g. claude,kiro) (default: all — installs every platform)
#   --self-update      Also update the dev-tasks.sh script (update only)

set -euo pipefail

# ─── Constants ────────────────────────────────────────────────────────────────

REPO_OWNER="llipe"
REPO_NAME="dev-tasks"
REPO_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}"
SCRIPT_VERSION="1.0.0"
VERSION_FILE=".dev-tasks-version"
BACKUP_DIR=".dev-tasks-backup"
AGENTS_UPDATE_FILE=".dev-tasks-agents-update.md"
CLAUDE_UPDATE_FILE=".dev-tasks-claude-update.md"
CLAUDE_SETTINGS_UPDATE_FILE=".dev-tasks-claude-settings-update.json"
GH_API="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases"

PROFILE_BOTH="both"
PROFILE_COPILOT="copilot"
PROFILE_CLAUDE="claude"
PROFILE_KIRO="kiro"
PROFILE_ALL="all"

# Copilot paths the script manages (relative to consumer repo root)
COPILOT_MANAGED_DIRS=(
  ".github/agents"
  ".github/skills"
  ".github/instructions"
  ".github/instructions/domain"
  ".github/prompts"
)

# Claude paths the script manages (relative to consumer repo root)
CLAUDE_MANAGED_DIRS=(
  ".claude/agents"
  ".claude/skills"
  ".claude/commands"
  ".claude/hooks"
)

# Kiro paths the script manages (relative to consumer repo root)
KIRO_MANAGED_DIRS=(
  ".kiro/agents"
  ".kiro/skills"
  ".kiro/steering"
  ".kiro/hooks"
)

# Active managed paths (computed from selected profile)
MANAGED_DIRS=("${COPILOT_MANAGED_DIRS[@]}" "${CLAUDE_MANAGED_DIRS[@]}" "${KIRO_MANAGED_DIRS[@]}")
MANAGED_FILES=()

# Colors (disabled when stderr is not a tty — all diagnostics go to stderr)
if [ -t 2 ]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; RESET=''
fi

# ─── Helpers ──────────────────────────────────────────────────────────────────
# All diagnostic output goes to stderr so command substitutions (e.g.
# bundle_file=$(download_bundle ...)) capture only the actual return value.

info()    { printf "%b\\n" "${CYAN}[dev-tasks]${RESET} $*" >&2; }
success() { printf "%b\\n" "${GREEN}[dev-tasks]${RESET} $*" >&2; }
warn()    { printf "%b\\n" "${YELLOW}[dev-tasks] WARN:${RESET} $*" >&2; }
error()   { printf "%b\\n" "${RED}[dev-tasks] ERROR:${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }
bold()    { printf "%b\\n" "${BOLD}$*${RESET}" >&2; }

check_deps() {
  local missing=()
  for cmd in curl tar; do
    command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
  done
  # shasum (macOS) or sha256sum (Linux)
  if ! command -v shasum >/dev/null 2>&1 && ! command -v sha256sum >/dev/null 2>&1; then
    missing+=("shasum or sha256sum")
  fi
  if [ ${#missing[@]} -gt 0 ]; then
    die "Missing required tools: ${missing[*]}. Install them and try again."
  fi
}

sha256() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    sha256sum "$file" | awk '{print $1}'
  fi
}

get_self_path() {
  # Return the absolute path of the running script, without relying on realpath/readlink.
  printf '%s/%s' "$(cd "$(dirname "$0")" && pwd)" "$(basename "$0")"
}

confirm() {
  local prompt="$1"
  local auto_yes="${2:-false}"
  if [ "$auto_yes" = "true" ]; then return 0; fi
  printf "%b" "${YELLOW}[dev-tasks]${RESET} ${prompt} [y/N] "
  read -r answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

# Die (in the CALLER's shell, not a subshell) if a token isn't a recognized profile.
# Must be invoked directly in set_managed_scope's loop — never from inside a
# process substitution / pipeline, where `die`'s `exit` would only kill the subshell.
validate_profile_token() {
  local token="$1"
  case "$token" in
    "$PROFILE_COPILOT" | github | "$PROFILE_CLAUDE" | "$PROFILE_KIRO" | "$PROFILE_BOTH" | "$PROFILE_ALL") ;;
    *)
      die "Invalid profile '${token}'. Valid values: ${PROFILE_COPILOT} (or github), ${PROFILE_CLAUDE}, ${PROFILE_KIRO}, ${PROFILE_BOTH}, ${PROFILE_ALL}, or a comma-separated combination (e.g. claude,kiro)."
      ;;
  esac
}

# Expand a single (already-validated) profile token to its managed dirs.
# "github" is accepted as an alias for "copilot" since Copilot files live under .github/.
resolve_profile_token() {
  local token="$1"
  case "$token" in
    "$PROFILE_COPILOT" | "github")
      printf '%s\n' "${COPILOT_MANAGED_DIRS[@]}"
      ;;
    "$PROFILE_CLAUDE")
      printf '%s\n' "${CLAUDE_MANAGED_DIRS[@]}"
      ;;
    "$PROFILE_KIRO")
      printf '%s\n' "${KIRO_MANAGED_DIRS[@]}"
      ;;
    "$PROFILE_BOTH" | "$PROFILE_ALL")
      printf '%s\n' "${COPILOT_MANAGED_DIRS[@]}" "${CLAUDE_MANAGED_DIRS[@]}" "${KIRO_MANAGED_DIRS[@]}"
      ;;
  esac
}

# True if the (possibly comma-separated) profile string includes the given platform.
# platform is one of: copilot | claude | kiro
profile_includes() {
  local profile="$1" platform="$2"
  local IFS=','
  local -a tokens=($profile)
  unset IFS

  local token
  for token in "${tokens[@]}"; do
    token="$(printf '%s' "$token" | tr -d '[:space:]')"
    case "$platform" in
      copilot)
        case "$token" in "$PROFILE_COPILOT" | github | "$PROFILE_BOTH" | "$PROFILE_ALL") return 0 ;; esac
        ;;
      claude)
        case "$token" in "$PROFILE_CLAUDE" | "$PROFILE_BOTH" | "$PROFILE_ALL") return 0 ;; esac
        ;;
      kiro)
        case "$token" in "$PROFILE_KIRO" | "$PROFILE_BOTH" | "$PROFILE_ALL") return 0 ;; esac
        ;;
    esac
  done
  return 1
}

set_managed_scope() {
  local profile="${1:-$PROFILE_ALL}"
  MANAGED_DIRS=()

  local IFS=','
  local -a tokens=($profile)
  unset IFS

  local token dir existing already
  for token in "${tokens[@]}"; do
    token="$(printf '%s' "$token" | tr -d '[:space:]')"
    [ -z "$token" ] && continue
    validate_profile_token "$token"
    while IFS= read -r dir; do
      already=false
      for existing in "${MANAGED_DIRS[@]+${MANAGED_DIRS[@]}}"; do
        if [ "$existing" = "$dir" ]; then already=true; break; fi
      done
      [ "$already" = "false" ] && MANAGED_DIRS+=("$dir")
    done < <(resolve_profile_token "$token")
  done
}

# ─── GitHub API ───────────────────────────────────────────────────────────────

fetch_release_info() {
  local version="${1:-latest}"
  local url
  if [ "$version" = "latest" ]; then
    url="${GH_API}/latest"
  else
    # Strip leading 'v' for API call, re-add for tag lookup
    local tag="v${version#v}"
    url="${GH_API}/tags/${tag}"
  fi

  local response
  response=$(curl -fsSL \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$url" 2>&1) || {
    die "Failed to fetch release info from GitHub. Check your network connection.\nURL: ${url}\nError: ${response}"
  }

  printf '%s' "$response"
}

extract_field() {
  # Minimal JSON field extractor — avoids jq dependency
  local json="$1" field="$2"
  # Try jq first for correctness, fall back to grep/sed
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -r ".$field // empty"
  else
    printf '%s' "$json" | grep -o "\"${field}\":[[:space:]]*\"[^\"]*\"" \
      | head -1 | sed 's/.*": *"\(.*\)"/\1/'
  fi
}

get_asset_url() {
  local release_json="$1" filename_pattern="$2"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$release_json" \
      | jq -r --arg pat "$filename_pattern" \
        '.assets[] | select(.name | test($pat)) | .browser_download_url' \
      | head -1
  else
    printf '%s' "$release_json" \
      | grep -o '"browser_download_url":"[^"]*'"${filename_pattern}"'[^"]*"' \
      | head -1 | sed 's/"browser_download_url":"\(.*\)"/\1/'
  fi
}

# ─── Version Metadata ─────────────────────────────────────────────────────────

read_installed_version() {
  if [ ! -f "$VERSION_FILE" ]; then
    printf ''
    return
  fi
  if command -v jq >/dev/null 2>&1; then
    jq -r '.version // empty' "$VERSION_FILE" 2>/dev/null || printf ''
  else
    grep -o '"version":"[^"]*"' "$VERSION_FILE" | sed 's/"version":"\(.*\)"/\1/' || printf ''
  fi
}

write_version_file() {
  local version="$1" dry_run="${2:-false}"
  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%d %H:%M:%S UTC")
  local content
  content=$(printf '{
  "version": "%s",
  "installed_at": "%s",
  "script_version": "%s",
  "source": "%s"
}\n' "$version" "$now" "$SCRIPT_VERSION" "$REPO_URL")

  if [ "$dry_run" = "true" ]; then
    info "[dry-run] Would write ${VERSION_FILE}:"
    printf '%s\n' "$content"
  else
    printf '%s\n' "$content" > "$VERSION_FILE"
  fi
}

# ─── Local Modification Detection ─────────────────────────────────────────────

checksum_file() {
  local file="$1"
  [ -f "$file" ] && sha256 "$file" || printf 'MISSING'
}

detect_modifications() {
  # Compare managed files against a reference tarball extracted in TMPDIR
  local ref_dir="$1"
  local modified=()

  for dir in "${MANAGED_DIRS[@]}"; do
    if [ -d "${ref_dir}/${dir}" ]; then
      while IFS= read -r -d '' ref_file; do
        local rel="${ref_file#${ref_dir}/}"
        local local_file="./${rel}"
        if [ -f "$local_file" ]; then
          local ref_sum local_sum
          ref_sum=$(sha256 "$ref_file")
          local_sum=$(sha256 "$local_file")
          if [ "$ref_sum" != "$local_sum" ]; then
            modified+=("$rel")
          fi
        fi
      done < <(find "${ref_dir}/${dir}" -type f -print0 2>/dev/null)
    fi
  done

  for file in "${MANAGED_FILES[@]+${MANAGED_FILES[@]}}"; do
    local ref_file="${ref_dir}/${file}"
    if [ -f "$ref_file" ] && [ -f "./${file}" ]; then
      local ref_sum local_sum
      ref_sum=$(sha256 "$ref_file")
      local_sum=$(sha256 "./${file}")
      if [ "$ref_sum" != "$local_sum" ]; then
        modified+=("$file")
      fi
    fi
  done

  printf '%s\n' "${modified[@]+"${modified[@]}"}"
}

# ─── Backup ───────────────────────────────────────────────────────────────────

backup_managed_files() {
  local dry_run="${1:-false}"
  local ts
  ts=$(date -u +"%Y%m%d_%H%M%S" 2>/dev/null || date +"%Y%m%d_%H%M%S")
  local dest="${BACKUP_DIR}/${ts}"

  if [ "$dry_run" = "true" ]; then
    info "[dry-run] Would back up managed files to ${dest}/"
    return
  fi

  info "Backing up managed files to ${dest}/ ..."
  mkdir -p "$dest"

  for dir in "${MANAGED_DIRS[@]}"; do
    if [ -d "./${dir}" ]; then
      mkdir -p "${dest}/${dir}"
      cp -r "./${dir}/." "${dest}/${dir}/"
    fi
  done

  for file in "${MANAGED_FILES[@]+${MANAGED_FILES[@]}}"; do
    if [ -f "./${file}" ]; then
      cp "./${file}" "${dest}/${file}"
    fi
  done

  [ -f "$VERSION_FILE" ] && cp "$VERSION_FILE" "${dest}/${VERSION_FILE}" || true
  success "Backup saved to ${dest}/"
}

# ─── Download & Verify ────────────────────────────────────────────────────────

download_bundle() {
  local release_json="$1" tmpdir="$2"
  local version
  version=$(extract_field "$release_json" "tag_name")
  version="${version#v}"  # strip leading 'v'

  local bundle_name="dev-tasks-bundle-v${version}.tar.gz"
  local checksum_name="${bundle_name}.sha256"

  local bundle_url checksum_url
  bundle_url=$(get_asset_url "$release_json" "dev-tasks-bundle")
  checksum_url=$(get_asset_url "$release_json" "sha256")

  if [ -z "$bundle_url" ]; then
    die "No bundle asset found in release ${version}. The release may be malformed."
  fi

  local bundle_file="${tmpdir}/${bundle_name}"

  info "Downloading bundle v${version} ..."
  curl -fsSL --progress-bar "$bundle_url" -o "$bundle_file" || \
    die "Download failed. Check your network connection and try again."

  # Verify checksum if available
  if [ -n "$checksum_url" ]; then
    local checksum_file="${tmpdir}/${checksum_name}"
    info "Verifying checksum ..."
    curl -fsSL "$checksum_url" -o "$checksum_file" || \
      warn "Could not download checksum file — skipping integrity check."

    if [ -f "$checksum_file" ]; then
      local expected actual
      expected=$(awk '{print $1}' "$checksum_file")
      actual=$(sha256 "$bundle_file")
      if [ "$expected" != "$actual" ]; then
        rm -f "$bundle_file" "$checksum_file"
        die "Checksum mismatch! The downloaded bundle may be corrupt or tampered with.\n  expected: ${expected}\n  actual:   ${actual}"
      fi
      success "Checksum verified."
    fi
  else
    warn "No checksum asset found for this release — skipping integrity check."
  fi

  printf '%s' "$bundle_file"
}

extract_bundle() {
  local bundle_file="$1" extract_dir="$2"
  mkdir -p "$extract_dir"
  tar -xzf "$bundle_file" -C "$extract_dir" 2>/dev/null || \
    die "Failed to extract bundle. The archive may be corrupt."
}

# ─── Install Files ─────────────────────────────────────────────────────────────

install_files() {
  local src_dir="$1" dry_run="${2:-false}"
  local installed=() skipped=()

  for dir in "${MANAGED_DIRS[@]}"; do
    local src="${src_dir}/${dir}"
    if [ ! -d "$src" ]; then continue; fi

    if [ "$dry_run" = "true" ]; then
      info "[dry-run] Would install: ${dir}/"
      while IFS= read -r -d '' f; do
        info "  ${f#${src_dir}/}"
        installed+=("${f#${src_dir}/}")
      done < <(find "$src" -type f -print0 2>/dev/null)
    else
      mkdir -p "./${dir}"
      cp -r "${src}/." "./${dir}/"
      while IFS= read -r -d '' f; do
        installed+=("${f#${src_dir}/}")
      done < <(find "$src" -type f -print0 2>/dev/null)
    fi
  done

  for file in "${MANAGED_FILES[@]+${MANAGED_FILES[@]}}"; do
    local src="${src_dir}/${file}"
    if [ ! -f "$src" ]; then continue; fi
    if [ "$dry_run" = "true" ]; then
      info "[dry-run] Would install: ${file}"
    else
      cp "$src" "./${file}"
    fi
    installed+=("$file")
  done

  printf '%s\n' "${installed[@]+"${installed[@]}"}"
}

# ─── Script Self-Update ────────────────────────────────────────────────────────

self_update_script() {
  local src_dir="$1" version="$2" dry_run="${3:-false}" do_backup="${4:-false}"

  local bundled_script="${src_dir}/dev-tasks.sh"
  if [ ! -f "$bundled_script" ]; then
    warn "dev-tasks.sh not found in bundle — skipping script self-update."
    return
  fi

  local self_path
  self_path=$(get_self_path)

  # Check if update is needed
  if [ -f "$self_path" ]; then
    local current_sum bundle_sum
    current_sum=$(sha256 "$self_path")
    bundle_sum=$(sha256 "$bundled_script")
    if [ "$current_sum" = "$bundle_sum" ]; then
      success "dev-tasks.sh is already up to date (v${version})."
      return
    fi
  fi

  info "Updating dev-tasks.sh to v${version} ..."

  if [ "$do_backup" = "true" ] && [ "$dry_run" = "false" ]; then
    local ts
    ts=$(date -u +"%Y%m%d_%H%M%S" 2>/dev/null || date +"%Y%m%d_%H%M%S")
    local script_backup="${BACKUP_DIR}/${ts}/dev-tasks.sh"
    mkdir -p "$(dirname "$script_backup")"
    cp "$self_path" "$script_backup"
    info "Backed up current dev-tasks.sh to ${script_backup}"
  fi

  if [ "$dry_run" = "true" ]; then
    info "[dry-run] Would replace ${self_path} with bundle v${version}."
    return
  fi

  local tmp_path="${self_path}.new.tmp"
  cp "$bundled_script" "$tmp_path"
  chmod +x "$tmp_path"
  mv "$tmp_path" "$self_path"
  success "dev-tasks.sh updated to v${version}."
}

# ─── AGENTS.md Integration Prompt ─────────────────────────────────────────────

print_agents_md_prompt() {
  local src_dir="$1" version="$2" dry_run="${3:-false}"
  local bundled_agents="${src_dir}/AGENTS.md"
  local consumer_agents="./AGENTS.md"

  bold "\n=== AGENTS.md Integration ==="
  printf "\n"
  info "The dev-tasks toolkit v${version} has been installed."
  info "Your AGENTS.md was NOT modified — you own that file."
  printf "\n"

  if [ ! -f "$bundled_agents" ]; then
    warn "No AGENTS.md found in the bundle — skipping integration prompt."
    return
  fi

  if [ ! -f "$consumer_agents" ]; then
    if [ "$dry_run" = "true" ]; then
      info "[dry-run] Would save bundle AGENTS.md reference to: ${AGENTS_UPDATE_FILE}"
    else
      cp "$bundled_agents" "$AGENTS_UPDATE_FILE"
      info "Saved bundle AGENTS.md reference to: ${AGENTS_UPDATE_FILE}"
    fi
    printf "%b\n" "${YELLOW}No AGENTS.md found in this repo. To create one, copy from the bundle:${RESET}"
    printf "\n  cp ${AGENTS_UPDATE_FILE} ./AGENTS.md\n\n"
  else
    if command -v diff >/dev/null 2>&1; then
      local diff_output
      diff_output=$(diff --unified=3 "$consumer_agents" "$bundled_agents" 2>/dev/null || true)
      if [ -z "$diff_output" ]; then
        success "Your AGENTS.md is already up to date with the bundle."
        return
      fi
      printf "%b\n" "${YELLOW}Changes in this release that may affect AGENTS.md:${RESET}"
      printf "\n%s\n\n" "$diff_output"
    fi

    info "Reference AGENTS.md from the bundle has been saved to: ${AGENTS_UPDATE_FILE}"
    if [ "$dry_run" = "false" ]; then
      cp "$bundled_agents" "$AGENTS_UPDATE_FILE"
    fi
    printf "Review the diff above and merge changes into your AGENTS.md manually.\n"
    printf "The reference file is at: %s\n\n" "$AGENTS_UPDATE_FILE"
  fi
  bold "============================================="
  printf "\n"
}

# ─── CLAUDE.md Integration Prompt ─────────────────────────────────────────────

print_claude_md_prompt() {
  local src_dir="$1" version="$2" dry_run="${3:-false}"
  local bundled_claude="${src_dir}/CLAUDE.md"
  local bundled_settings="${src_dir}/.claude/settings.json"
  local consumer_claude="./CLAUDE.md"

  # Only relevant if the bundle ships Claude Code support.
  if [ ! -f "$bundled_claude" ]; then
    return
  fi

  bold "\n=== CLAUDE.md Integration (Claude Code) ==="
  printf "\n"
  info "Claude Code config installed: .claude/agents, .claude/skills, .claude/commands, .claude/hooks."
  info "Your CLAUDE.md and .claude/settings.json were NOT modified — you own those files."
  printf "\n"

  if [ ! -f "$consumer_claude" ]; then
    if [ "$dry_run" = "true" ]; then
      info "[dry-run] Would save bundle CLAUDE.md reference to: ${CLAUDE_UPDATE_FILE}"
    else
      cp "$bundled_claude" "$CLAUDE_UPDATE_FILE"
      info "Saved bundle CLAUDE.md reference to: ${CLAUDE_UPDATE_FILE}"
    fi

    if [ -f "$bundled_settings" ]; then
      if [ "$dry_run" = "true" ]; then
        info "[dry-run] Would save bundle Claude settings reference to: ${CLAUDE_SETTINGS_UPDATE_FILE}"
      else
        cp "$bundled_settings" "$CLAUDE_SETTINGS_UPDATE_FILE"
        info "Saved bundle Claude settings reference to: ${CLAUDE_SETTINGS_UPDATE_FILE}"
      fi
    fi

    printf "%b\n" "${YELLOW}No CLAUDE.md found in this repo. To create one, copy from the bundle:${RESET}"
    printf "\n  cp ${CLAUDE_UPDATE_FILE} ./CLAUDE.md\n\n"
    if [ -f "$bundled_settings" ] || { [ "$dry_run" = "false" ] && [ -f "${CLAUDE_SETTINGS_UPDATE_FILE}" ]; }; then
      info "To enable the git-guard hook, also copy the reference settings:"
      printf "\n  mkdir -p .claude && cp ${CLAUDE_SETTINGS_UPDATE_FILE} ./.claude/settings.json\n\n"
    fi
  else
    if command -v diff >/dev/null 2>&1; then
      local diff_output
      diff_output=$(diff --unified=3 "$consumer_claude" "$bundled_claude" 2>/dev/null || true)
      if [ -z "$diff_output" ]; then
        success "Your CLAUDE.md is already up to date with the bundle."
      else
        printf "%b\n" "${YELLOW}Changes in this release that may affect CLAUDE.md:${RESET}"
        printf "\n%s\n\n" "$diff_output"
        info "Reference CLAUDE.md from the bundle has been saved to: ${CLAUDE_UPDATE_FILE}"
        if [ "$dry_run" = "false" ]; then
          cp "$bundled_claude" "$CLAUDE_UPDATE_FILE"
        fi
        printf "Review the diff above and merge changes into your CLAUDE.md manually.\n"
        printf "The reference file is at: %s\n\n" "$CLAUDE_UPDATE_FILE"
      fi
    fi
  fi
  bold "============================================="
  printf "\n"
}

# ─── Commands ─────────────────────────────────────────────────────────────────

cmd_version() {
  local installed
  installed=$(read_installed_version)
  if [ -z "$installed" ]; then
    printf "dev-tasks: not installed in this directory (no %s found)\n" "$VERSION_FILE"
    printf "script version: %s\n" "$SCRIPT_VERSION"
    exit 0
  fi

  printf "installed toolkit: v%s\n" "$installed"
  printf "script version:    %s\n" "$SCRIPT_VERSION"
  if command -v jq >/dev/null 2>&1 && [ -f "$VERSION_FILE" ]; then
    local installed_at
    installed_at=$(jq -r '.installed_at // empty' "$VERSION_FILE" 2>/dev/null || true)
    [ -n "$installed_at" ] && printf "installed at:      %s\n" "$installed_at"
  fi
}

cmd_check() {
  local installed
  installed=$(read_installed_version)

  info "Fetching latest release info from GitHub ..."
  local release_json latest_tag latest_version
  release_json=$(fetch_release_info "latest")
  latest_tag=$(extract_field "$release_json" "tag_name")
  latest_version="${latest_tag#v}"

  if [ -z "$installed" ]; then
    printf "Not installed. Latest available: v%s\n" "$latest_version"
    printf "Run: ./dev-tasks.sh install\n"
    exit 0
  fi

  printf "Installed: v%s\n" "$installed"
  printf "Latest:    v%s\n" "$latest_version"

  if [ "$installed" = "$latest_version" ]; then
    success "You are up to date."
  else
    printf "\n"
    warn "A newer version is available."
    printf "Run: ./dev-tasks.sh update\n"
  fi
}

cmd_list() {
  local installed
  installed=$(read_installed_version)

  if [ -z "$installed" ]; then
    printf "dev-tasks: not installed in this directory (no %s found)\n" "$VERSION_FILE"
    exit 0
  fi

  success "Installed toolkit v${installed}"
  printf "\n"
  bold "Managed Directories:"
  for dir in "${MANAGED_DIRS[@]}"; do
    if [ -d "./${dir}" ]; then
      local file_count
      file_count=$(find "./${dir}" -type f 2>/dev/null | wc -l | tr -d ' ')
      printf "  %s (%d files)\n" "$dir" "$file_count"
    else
      printf "  %s (not installed)\n" "$dir"
    fi
  done

  printf "\n"
  bold "Metadata Files:"
  [ -f "$VERSION_FILE" ] && printf "  %s\n" "$VERSION_FILE" || printf "  %s (missing)\n" "$VERSION_FILE"
  [ -f "$AGENTS_UPDATE_FILE" ] && printf "  %s\n" "$AGENTS_UPDATE_FILE" || true
  [ -f "$CLAUDE_UPDATE_FILE" ] && printf "  %s\n" "$CLAUDE_UPDATE_FILE" || true
  [ -f "$CLAUDE_SETTINGS_UPDATE_FILE" ] && printf "  %s\n" "$CLAUDE_SETTINGS_UPDATE_FILE" || true
  [ -d "$BACKUP_DIR" ] && printf "  %s (backup directory)\n" "$BACKUP_DIR" || true
}

cmd_self_update() {
  local target_version="${1:-latest}"
  local dry_run="${2:-false}"
  local do_backup="${3:-false}"
  local auto_yes="${4:-false}"

  check_deps

  info "Fetching release info (${target_version}) ..."
  local release_json version
  release_json=$(fetch_release_info "$target_version")
  version=$(extract_field "$release_json" "tag_name")
  version="${version#v}"

  if [ -z "$version" ]; then
    die "Could not determine the target release version."
  fi

  local tmpdir
  tmpdir=$(mktemp -d)
  # shellcheck disable=SC2064
  trap "rm -rf '${tmpdir}'" EXIT

  local bundle_file extract_dir
  bundle_file=$(download_bundle "$release_json" "$tmpdir")
  extract_dir="${tmpdir}/extracted"
  extract_bundle "$bundle_file" "$extract_dir"

  local src_dir="$extract_dir"
  if [ "$(ls -A "$extract_dir" | wc -l | tr -d ' ')" = "1" ]; then
    local inner
    inner=$(ls -A "$extract_dir")
    if [ -d "${extract_dir}/${inner}" ]; then
      src_dir="${extract_dir}/${inner}"
    fi
  fi

  self_update_script "$src_dir" "$version" "$dry_run" "$do_backup"
}

cmd_install() {
  local target_version="${1:-latest}"
  local dry_run="${2:-false}"
  local do_backup="${3:-false}"
  local auto_yes="${4:-false}"
  local profile="${5:-$PROFILE_ALL}"

  set_managed_scope "$profile"

  check_deps

  local installed
  installed=$(read_installed_version)
  if [ -n "$installed" ] && [ "$dry_run" = "false" ]; then
    warn "Toolkit v${installed} is already installed."
    confirm "Reinstall?" "$auto_yes" || { info "Aborted."; exit 0; }
  fi

  local tmpdir
  tmpdir=$(mktemp -d)
  # shellcheck disable=SC2064
  trap "rm -rf '${tmpdir}'" EXIT

  info "Fetching release info (${target_version}) ..."
  local release_json version
  release_json=$(fetch_release_info "$target_version")
  version=$(extract_field "$release_json" "tag_name")
  version="${version#v}"

  if [ -z "$version" ]; then
    die "Could not determine release version. The release may not exist."
  fi

  [ "$dry_run" = "true" ] && info "[dry-run] Would install v${version}"

  local bundle_file extract_dir
  bundle_file=$(download_bundle "$release_json" "$tmpdir")
  extract_dir="${tmpdir}/extracted"
  extract_bundle "$bundle_file" "$extract_dir"

  # Detect the inner bundle directory (tarball may extract to a sub-folder)
  local src_dir="$extract_dir"
  if [ "$(ls -A "$extract_dir" | wc -l | tr -d ' ')" = "1" ]; then
    local inner
    inner=$(ls -A "$extract_dir")
    if [ -d "${extract_dir}/${inner}" ]; then
      src_dir="${extract_dir}/${inner}"
    fi
  fi

  [ "$do_backup" = "true" ] && backup_managed_files "$dry_run"

  info "Installing managed files (profile: ${profile}) ..."
  install_files "$src_dir" "$dry_run"

  write_version_file "$version" "$dry_run"

  if profile_includes "$profile" copilot; then
    print_agents_md_prompt "$src_dir" "$version" "$dry_run"
  fi
  if profile_includes "$profile" claude; then
    print_claude_md_prompt "$src_dir" "$version" "$dry_run"
  fi
  [ "$dry_run" = "true" ] && success "[dry-run] Install simulation complete — no files were modified." \
                           || success "Installed dev-tasks v${version}."
}

cmd_update() {
  local target_version="${1:-latest}"
  local dry_run="${2:-false}"
  local do_backup="${3:-false}"
  local auto_yes="${4:-false}"
  local profile="${5:-$PROFILE_ALL}"
  local self_update="${6:-false}"

  set_managed_scope "$profile"

  check_deps

  local installed
  installed=$(read_installed_version)

  info "Fetching release info (${target_version}) ..."
  local release_json latest_version
  release_json=$(fetch_release_info "$target_version")
  latest_version=$(extract_field "$release_json" "tag_name")
  latest_version="${latest_version#v}"

  if [ -z "$latest_version" ]; then
    die "Could not determine the target release version."
  fi

  if [ -n "$installed" ] && [ "$installed" = "$latest_version" ]; then
    success "Already at v${latest_version} — nothing to update."
    exit 0
  fi

  if [ -n "$installed" ]; then
    info "Updating from v${installed} → v${latest_version}"
  else
    info "No installed version found. Installing v${latest_version} ..."
  fi

  local tmpdir
  tmpdir=$(mktemp -d)
  # shellcheck disable=SC2064
  trap "rm -rf '${tmpdir}'" EXIT

  local bundle_file extract_dir
  bundle_file=$(download_bundle "$release_json" "$tmpdir")
  extract_dir="${tmpdir}/extracted"
  extract_bundle "$bundle_file" "$extract_dir"

  local src_dir="$extract_dir"
  if [ "$(ls -A "$extract_dir" | wc -l | tr -d ' ')" = "1" ]; then
    local inner
    inner=$(ls -A "$extract_dir")
    if [ -d "${extract_dir}/${inner}" ]; then
      src_dir="${extract_dir}/${inner}"
    fi
  fi

  # Detect local modifications against the incoming bundle
  info "Checking for local modifications (profile: ${profile}) ..."
  local modified_list
  modified_list=$(detect_modifications "$src_dir")

  if [ -n "$modified_list" ]; then
    warn "The following managed files have local modifications:"
    while IFS= read -r f; do [ -n "$f" ] && printf "  - %s\n" "$f"; done <<< "$modified_list"
    printf "\n"
    confirm "These will be overwritten. Continue?" "$auto_yes" || { info "Update aborted. Your files are unchanged."; exit 0; }
  fi

  [ "$do_backup" = "true" ] && backup_managed_files "$dry_run"

  info "Installing updated files (profile: ${profile}) ..."
  install_files "$src_dir" "$dry_run"

  write_version_file "$latest_version" "$dry_run"

  if profile_includes "$profile" copilot; then
    print_agents_md_prompt "$src_dir" "$latest_version" "$dry_run"
  fi
  if profile_includes "$profile" claude; then
    print_claude_md_prompt "$src_dir" "$latest_version" "$dry_run"
  fi
  if [ "$self_update" = "true" ]; then
    self_update_script "$src_dir" "$latest_version" "$dry_run" "$do_backup"
  fi
  [ "$dry_run" = "true" ] && success "[dry-run] Update simulation complete — no files were modified." \
                           || success "Updated dev-tasks to v${latest_version}."
}

# ─── Usage ────────────────────────────────────────────────────────────────────

usage() {
  cat <<EOF
${BOLD}dev-tasks.sh${RESET} — Install and manage the dev-tasks AI agent toolkit

${BOLD}USAGE${RESET}
  ./dev-tasks.sh <command> [version] [options]

${BOLD}COMMANDS${RESET}
  install     [version]  Install the toolkit (default: latest)
  update      [version]  Update to latest or a pinned version
  self-update [version]  Update only the dev-tasks.sh script itself
  check                  Compare installed version vs latest
  list                   List installed directories and files
  version                Print installed version information

${BOLD}OPTIONS${RESET} (install / update / self-update)
  --dry-run           Show planned changes without writing any files
  --backup            Back up managed files to ${BACKUP_DIR}/ before replacing
  --yes               Skip confirmation prompts
  --profile <name>    Install/update file sets: copilot | claude | kiro | both | all,
                      or a comma-separated combination (e.g. claude,kiro or claude,github)
                      (default: all — installs every platform; 'both' is a deprecated alias for 'all')
  --self-update       Also update the dev-tasks.sh script when running 'update'

${BOLD}EXAMPLES${RESET}
  # Bootstrap (first time)
  curl -fsSL https://raw.githubusercontent.com/llipe/dev-tasks/main/dev-tasks.sh \\
    -o dev-tasks.sh && chmod +x dev-tasks.sh

  # Install latest (installs Copilot + Claude + Kiro by default)
  ./dev-tasks.sh install

  # Install only Copilot toolkit files (.github/*)
  ./dev-tasks.sh install --profile copilot

  # Install only Claude toolkit files (.claude/*)
  ./dev-tasks.sh install --profile claude

  # Install only Kiro toolkit files (.kiro/*)
  ./dev-tasks.sh install --profile kiro

  # Install all three platforms (Copilot + Claude + Kiro)
  ./dev-tasks.sh install --profile all

  # Install a specific combination of platforms (comma-separated, any order)
  ./dev-tasks.sh install --profile claude,kiro
  ./dev-tasks.sh install --profile claude,kiro,github

  # Install specific version
  ./dev-tasks.sh install v1.2.0

  # Check for updates
  ./dev-tasks.sh check

  # List installed files
  ./dev-tasks.sh list

  # Update toolkit files with backup
  ./dev-tasks.sh update --backup

  # Update toolkit files AND the script itself
  ./dev-tasks.sh update --self-update

  # Update only the script itself (no toolkit files changed)
  ./dev-tasks.sh self-update

  # Update only Claude toolkit files
  ./dev-tasks.sh update --profile claude

  # Preview update (dry run)
  ./dev-tasks.sh update --dry-run

  # Preview script self-update (dry run)
  ./dev-tasks.sh self-update --dry-run

${BOLD}FILES${RESET}
  ${VERSION_FILE}         Installed version metadata (JSON)
  ${AGENTS_UPDATE_FILE}   Reference AGENTS.md from last install/update
  ${CLAUDE_UPDATE_FILE}   Reference CLAUDE.md from last install/update
  ${CLAUDE_SETTINGS_UPDATE_FILE}  Reference .claude/settings.json from last install/update
  ${BACKUP_DIR}/          Backups of managed files (when --backup is used)

${BOLD}SOURCE${RESET}
  ${REPO_URL}
EOF
}

# ─── Entry Point ──────────────────────────────────────────────────────────────

main() {
  local command="${1:-}"
  shift || true

  # Parse shared flags
  local dry_run=false do_backup=false auto_yes=false target_version="latest" profile="$PROFILE_ALL" self_update=false

  while [ $# -gt 0 ]; do
    case "$1" in
      --dry-run)     dry_run=true;    shift ;;
      --backup)      do_backup=true;  shift ;;
      --yes|-y)      auto_yes=true;   shift ;;
      --self-update) self_update=true; shift ;;
      --profile)
        [ $# -ge 2 ] || die "Missing value for --profile. Use: copilot | claude | kiro | both | all, or a comma-separated combination (e.g. claude,kiro)"
        profile="$2"
        shift 2
        ;;
      --profile=*)
        profile="${1#*=}"
        shift
        ;;
      v[0-9]* | [0-9]*)  target_version="$1"; shift ;;
      -*)
        error "Unknown option: $1"
        usage
        exit 1
        ;;
      *)
        error "Unexpected argument: $1"
        usage
        exit 1
        ;;
    esac
  done

  set_managed_scope "$profile"

  case "$command" in
    install)     cmd_install     "$target_version" "$dry_run" "$do_backup" "$auto_yes" "$profile" ;;
    update)      cmd_update      "$target_version" "$dry_run" "$do_backup" "$auto_yes" "$profile" "$self_update" ;;
    self-update) cmd_self_update "$target_version" "$dry_run" "$do_backup" "$auto_yes" ;;
    check)       cmd_check ;;
    list)        cmd_list ;;
    version)     cmd_version ;;
    help | --help | -h) usage; exit 0 ;;
    "")
      error "No command specified."
      usage
      exit 1
      ;;
    *)
      error "Unknown command: ${command}"
      usage
      exit 1
      ;;
  esac
}

main "$@"
