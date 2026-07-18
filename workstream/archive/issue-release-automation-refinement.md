# Issue Refinement: Release Automation Script

## Changelog

| Version | Date       | Summary            | Author            |
| ------- | ---------- | ------------------ | ----------------- |
| 1.0     | 2025-07-15 | Initial refinement | product-engineer  |

## Summary

- **Goal:** Automate the release workflow into a single script that generates a CHANGELOG.md, commits it, creates a semver tag, and pushes the tag to trigger the existing `release-bundle.yml` CI pipeline.
- **Primary user impact:** Maintainers get a repeatable, error-free release process that auto-generates functional and technical change summaries from commit history and merged PR metadata.
- **Non-goals:** Modifying the existing CI workflow; auto-merging or auto-deploying; changing Conventional Commit enforcement.

## Acceptance Criteria

- [ ] AC-1: A script `scripts/release.sh` exists and is executable.
- [ ] AC-2: The script requires the user to pass a semver increment type (`major`, `minor`, or `patch`) as a positional argument.
- [ ] AC-3: Before prompting or acting, the script validates:
  - Current branch is `main`.
  - Working tree is clean (no uncommitted changes).
  - `scripts/format.sh --check` passes (the only quality gate available in this repo).
- [ ] AC-4: The script auto-generates a CHANGELOG.md entry covering all commits since the previous tag, grouped by Conventional Commit type (Features, Fixes, Chores/Other), including:
  - Commit subject lines.
  - Merged PR titles and bodies (fetched via `gh pr list --state merged`).
- [ ] AC-5: The script suggests an increment type based on commit analysis (presence of `feat!:` or `BREAKING CHANGE` → major, `feat:` → minor, `fix:` → patch) but respects the user-provided argument.
- [ ] AC-6: The generated CHANGELOG.md section follows [Keep a Changelog](https://keepachangelog.com/) format and is written in Markdown.
- [ ] AC-7: The script commits the updated CHANGELOG.md with message `docs: update CHANGELOG for vX.Y.Z`.
- [ ] AC-8: The script creates an annotated git tag `vX.Y.Z` on that commit.
- [ ] AC-9: The script pushes the tag to `origin`, triggering the existing `release-bundle.yml` workflow.
- [ ] AC-10: The script prints a summary of actions taken (new version, tag pushed, CI URL hint).
- [ ] AC-11: The script handles the case where no previous tag exists (treats all commits as the initial release).
- [ ] AC-12: `gh` CLI authenticated state is validated before PR metadata fetch; script warns gracefully if `gh` is unavailable and falls back to commit-only changelog.

## Constraints

- Shell script (`bash`), consistent with existing `scripts/` conventions (`set -euo pipefail`, helper functions, `REPO_ROOT` pattern).
- Must not require any runtime dependencies beyond `git`, `gh` (optional with fallback), and standard POSIX utilities.
- Must not push to any branch — only pushes the tag.
- The only quality-gate validation available is `scripts/format.sh --check`. No lint, typecheck, or test commands exist in this repo.

## Risks and Edge Cases

- **No `gh` CLI or unauthenticated:** Script must degrade gracefully (skip PR metadata, changelog from commits only).
- **No previous tags:** First release — include all commits from initial commit.
- **Dirty working tree:** Script must abort with clear message.
- **Not on `main`:** Script must abort with clear message.
- **Format check fails:** Script must abort and show the prettier output.
- **Tag already exists for computed version:** Script must abort and inform the user.
- **CHANGELOG.md doesn't exist yet:** Script must create it with the standard header.

## Dependencies

- Existing `scripts/format.sh` for pre-flight format validation.
- Existing `.github/workflows/release-bundle.yml` (triggered by tag push `v*`).
- `gh` CLI for PR metadata (optional, graceful fallback).

## Testing Notes

- **Manual checks:**
  - Run on a non-main branch → should abort.
  - Run with dirty tree → should abort.
  - Run with `--help` → should print usage.
  - Run with `patch` on main with clean tree → should produce CHANGELOG entry, commit, tag, push.
  - Run without `gh` auth → should produce commit-only changelog with warning.
- **Edge-case checks:**
  - First release (no prior tags).
  - Release when HEAD is already tagged.

## Open Questions

- None — scope is fully defined.
