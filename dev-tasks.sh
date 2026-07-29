#!/usr/bin/env bash
# dev-tasks migration shim
# This script replaces the legacy dev-tasks.sh self-update mechanism.
# It detects legacy installations and migrates to @llipe/dev-tasks.
#
# After migration, all distribution is handled by:
#   dev-tasks install   — install skills into a repo
#   dev-tasks update    — hash-based reconciliation update
#   dev-tasks status    — check installed vs pinned vs latest
#   dev-tasks pin       — pin to a specific version
#   dev-tasks doctor    — check environment prerequisites
#
# BREAKING CHANGE: Legacy self-update logic has been removed.
# Future updates go through npm/pnpm: `pnpm add -g @llipe/dev-tasks`
# or `npx @llipe/dev-tasks update`.

set -euo pipefail

# ─── Constants ────────────────────────────────────────────────────────────────

PACKAGE_NAME="@llipe/dev-tasks"
LEGACY_VERSION_FILE=".dev-tasks-version"

# Colors (disabled when stderr is not a tty)
if [ -t 2 ]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; RESET=''
fi

# ─── Helpers ──────────────────────────────────────────────────────────────────

info()    { printf "%b\\n" "${CYAN}[dev-tasks]${RESET} $*" >&2; }
success() { printf "%b\\n" "${GREEN}[dev-tasks]${RESET} $*" >&2; }
warn()    { printf "%b\\n" "${YELLOW}[dev-tasks] WARN:${RESET} $*" >&2; }
error()   { printf "%b\\n" "${RED}[dev-tasks] ERROR:${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

# ─── Detection ────────────────────────────────────────────────────────────────

is_package_installed() {
  # Check if @llipe/dev-tasks is available via npx or global install
  if command -v dev-tasks >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

is_legacy_install() {
  # Legacy indicators:
  # 1. .dev-tasks-version exists (old version marker)
  # 2. .dev-tasks/ directory exists without manifest.json
  if [ -f "$LEGACY_VERSION_FILE" ]; then
    return 0
  fi
  if [ -d ".dev-tasks" ] && [ ! -f ".dev-tasks/manifest.json" ]; then
    return 0
  fi
  return 1
}

# ─── Package Installation ─────────────────────────────────────────────────────

detect_package_manager() {
  if command -v pnpm >/dev/null 2>&1; then
    printf "pnpm"
  elif command -v npm >/dev/null 2>&1; then
    printf "npm"
  else
    printf ""
  fi
}

install_package() {
  local pm
  pm=$(detect_package_manager)

  if [ -z "$pm" ]; then
    die "Neither pnpm nor npm found. Install Node.js >= 20 with pnpm or npm first."
  fi

  info "Installing ${PACKAGE_NAME} via ${pm}..."

  if [ "$pm" = "pnpm" ]; then
    if ! pnpm add -g "${PACKAGE_NAME}" 2>&1; then
      die "Failed to install ${PACKAGE_NAME} via pnpm. Check your network connection and permissions."
    fi
  else
    if ! npm install -g "${PACKAGE_NAME}" 2>&1; then
      die "Failed to install ${PACKAGE_NAME} via npm. Check your network connection and permissions."
    fi
  fi

  success "Installed ${PACKAGE_NAME}."
}

# ─── Migration ────────────────────────────────────────────────────────────────

run_migration() {
  info "Running migration from legacy install..."

  if ! dev-tasks migrate 2>&1; then
    # Fallback: run via npx if the global binary isn't in PATH yet
    if ! npx --yes "${PACKAGE_NAME}" migrate 2>&1; then
      die "Migration failed. No partial manifest was written. Your files are untouched."
    fi
  fi

  success "Migration complete."
}

# ─── Notice ───────────────────────────────────────────────────────────────────

print_migration_notice() {
  printf "\n"
  printf "%b\n" "${BOLD}════════════════════════════════════════════════════════════════${RESET}"
  printf "%b\n" "${GREEN}  dev-tasks has been migrated to the npm package: ${PACKAGE_NAME}${RESET}"
  printf "%b\n" "${BOLD}════════════════════════════════════════════════════════════════${RESET}"
  printf "\n"
  printf "%b\n" "  ${BOLD}IMPORTANT:${RESET} The legacy self-update mechanism has been removed."
  printf "%b\n" "  Future updates are managed through npm/pnpm:"
  printf "\n"
  printf "%b\n" "    ${CYAN}# Update skills (hash-based reconciliation — won't clobber edits):${RESET}"
  printf "%b\n" "    dev-tasks update"
  printf "\n"
  printf "%b\n" "    ${CYAN}# Update the package itself:${RESET}"
  printf "%b\n" "    pnpm add -g ${PACKAGE_NAME}@latest"
  printf "%b\n" "    ${CYAN}# or: npm install -g ${PACKAGE_NAME}@latest${RESET}"
  printf "\n"
  printf "%b\n" "    ${CYAN}# Check current status:${RESET}"
  printf "%b\n" "    dev-tasks status"
  printf "\n"
  printf "%b\n" "  ${YELLOW}NOTE:${RESET} Your first 'dev-tasks update' will report conflicts for"
  printf "%b\n" "  all pre-existing files. This is expected — it ensures you can"
  printf "%b\n" "  review changes before accepting them. Use --force to accept all."
  printf "\n"
  printf "%b\n" "  This shim script (dev-tasks.sh) can be safely removed after migration."
  printf "\n"
  printf "%b\n" "${BOLD}════════════════════════════════════════════════════════════════${RESET}"
  printf "\n"
}

# ─── Entry Point ──────────────────────────────────────────────────────────────

main() {
  # If the package is already installed, just forward all args to it
  if is_package_installed; then
    exec dev-tasks "$@"
  fi

  # If not a legacy install, tell the user to install normally
  if ! is_legacy_install; then
    info "No legacy installation detected."
    info "Install ${PACKAGE_NAME} directly:"
    printf "\n"
    printf "  pnpm add -g %s\n" "${PACKAGE_NAME}"
    printf "  # or: npm install -g %s\n" "${PACKAGE_NAME}"
    printf "\n"
    exit 0
  fi

  # Legacy install detected — perform migration
  info "Legacy dev-tasks.sh installation detected."
  info "Migrating to ${PACKAGE_NAME}..."
  printf "\n"

  # Step 1: Install the package
  install_package

  # Step 2: Run migration (generates manifest with modified: unknown)
  run_migration

  # Step 3: Print the migration notice
  print_migration_notice

  # Forward any args passed to this script to the new binary
  if [ $# -gt 0 ]; then
    info "Forwarding command to dev-tasks: $*"
    exec dev-tasks "$@"
  fi
}

main "$@"
