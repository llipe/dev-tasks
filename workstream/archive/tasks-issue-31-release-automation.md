# Tasks: Release Automation Script

**Issue:** #31
**Branch:** issue/31-release-automation
**PR:** https://github.com/llipe/dev-tasks/pull/32

## Sub-tasks

- [x] 1. Create `scripts/release.sh` with scaffold (shebang, set flags, REPO_ROOT, usage, helpers)
- [x] 2. Implement pre-flight validations (branch check, clean tree, format check)
- [x] 3. Implement version computation (previous tag, semver bump, suggestion logic)
- [x] 4. Implement changelog generation (commit grouping, PR metadata via gh, fallback)
- [x] 5. Implement CHANGELOG.md file writing (Keep a Changelog format, create if missing)
- [x] 6. Implement commit, tag, push, and summary output
- [x] 7. Add edge-case handling (no prior tags, tag exists, gh unavailable)
- [x] 8. Run quality gate (format check) and verify script is executable

## Relevant Files

- `scripts/release.sh` — the new script
- `workstream/issue-release-automation-refinement.md` — refinement source
- `.github/workflows/release-bundle.yml` — triggered by tag push
