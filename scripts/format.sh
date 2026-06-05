#!/usr/bin/env bash
# scripts/format.sh — Run Prettier across tracked markdown, JSON, and YAML files.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: ./scripts/format.sh [--check|--write]

Defaults to --write.
EOF
}

mode="--write"

case "${1:-}" in
  "") ;;
  --check) mode="--check"; shift ;;
  --write) mode="--write"; shift ;;
  -h|--help) usage; exit 0 ;;
  *)
    printf 'Unknown option: %s\n' "$1" >&2
    usage
    exit 1
    ;;
esac

if [ $# -gt 0 ]; then
  printf 'Unexpected arguments: %s\n' "$*" >&2
  usage
  exit 1
fi

prettier_cmd=(prettier)
if ! command -v prettier >/dev/null 2>&1; then
  if command -v npx >/dev/null 2>&1; then
    prettier_cmd=(npx --yes prettier)
  else
    printf 'Prettier is not installed and npx is unavailable. Install one of them, then rerun this script.\n' >&2
    exit 1
  fi
fi

files=()
while IFS= read -r file; do
  files+=("$file")
done < <(
  git -C "$REPO_ROOT" ls-files \
    | grep -E '\.(md|json|ya?ml|cjs|mjs|js)$' \
    | grep -v '^dist/' \
    | grep -v '^\.dev-tasks-backup/'
)

if [ ${#files[@]} -eq 0 ]; then
  printf 'No tracked files found for Prettier.\n' >&2
  exit 0
fi

"${prettier_cmd[@]}" "$mode" --config "$REPO_ROOT/prettier.config.cjs" "${files[@]}"