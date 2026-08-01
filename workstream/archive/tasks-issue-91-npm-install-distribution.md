# Tasks: dev-tasks install (npm) does not distribute agent toolkit

**Issue:** #91
**Branch:** issue/91-npm-install-distribution
**Status:** Complete
**PR:** https://github.com/llipe/dev-tasks/pull/94

## Sub-tasks

- [x] 1. Create `core/distribution/profiles.ts` — profile-to-paths mapping
- [x] 2. Rewrite `core/distribution/install.ts` — profile-aware installation to native platform paths
- [x] 3. Generalize `core/distribution/manifest.ts` — track all managed files (not just skills)
- [x] 4. Update `core/distribution/update.ts` — reconcile all managed files across profiles
- [x] 5. Add `--profile` flag to CLI (`adapters/cli/parse-args.ts` + `bin/dev-tasks.ts`)
- [x] 6. Update `package.json` `files` array to include platform directories
- [x] 7. Remove deprecated top-level `skills/` directory
- [x] 8. Update `core/distribution/index.ts` exports
- [x] 9. Write unit tests for profiles, install, manifest, update
- [x] 10. Write integration tests for install/update with profiles
- [x] 11. Verify all quality gates pass (typecheck, lint, format, test, audit)

## Acceptance Criteria

- [x] `dev-tasks install` (no flags) installs copilot + claude platform directories into the consumer repo
- [x] `dev-tasks install --profile kiro` installs only `.kiro/` paths
- [x] `dev-tasks install --profile all` installs all three platforms
- [x] `.dev-tasks/manifest.json` tracks every installed file with path, profile, sha256, origin_sha256
- [x] `dev-tasks update` reconciles all managed files (not just skills)
- [x] `npm pack --dry-run` shows platform directories are included in the published package
- [x] Existing reconciliation logic (skip/overwrite/conflict/install) works for all file types
- [x] Invalid `--profile` value prints valid options and exits 2

## Relevant Files

- `core/distribution/profiles.ts` (new)
- `core/distribution/install.ts` (rewrite)
- `core/distribution/manifest.ts` (generalize)
- `core/distribution/update.ts` (generalize)
- `core/distribution/index.ts` (update exports)
- `adapters/cli/parse-args.ts` (add --profile)
- `bin/dev-tasks.ts` (route --profile)
- `package.json` (files array)
- `test/unit/distribution-profiles.test.ts` (new)
- `test/unit/distribution-install.test.ts` (rewrite)
- `test/unit/distribution-update.test.ts` (update)
- `test/integration/bootstrap-commands.test.ts` (update)
