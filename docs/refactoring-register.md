# Refactoring Register

## Changelog

| Version | Date       | Summary                           | Author                   |
| ------- | ---------- | --------------------------------- | ------------------------ |
| 1.0     | 2026-11-15 | First run: RF-001 to RF-013 added | refactor-review (Claude) |

One row per refactoring opportunity, never deleted. The register is the memory between runs of `/refactor-review`; each run's detail is in its report under `workstream/`. IDs are never reused.

Last run: 2026-11-15, `full`, commit `b4f23b9`, report [`refactor-review-2026-11-15.md`](../workstream/refactor-review-2026-11-15.md).

| ID     | Dim | Title                                                              | Location                                                                           | Score | Status   | First seen | Last seen  | Link |
| ------ | --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ----- | -------- | ---------- | ---------- | ---- |
| RF-001 | R8  | Test suite exits red and runs serially for nine minutes            | `vitest.config.ts`, tests that spawn child processes                               | 3.0   | Open     | 2026-11-15 | 2026-11-15 | —    |
| RF-002 | R1  | Root registry documents and their template twins                   | `AGENTS.md`, `CLAUDE.md`, and their `.template` files                              | 2.0   | Open     | 2026-11-15 | 2026-11-15 | —    |
| RF-003 | R1  | Platform skill copies maintained by hand                           | `.claude/skills`, `.github/skills`, `.kiro/skills`                                 | 1.8   | Open     | 2026-11-15 | 2026-11-15 | —    |
| RF-004 | R3  | Managed-path list written in three places                          | `core/distribution/profiles.ts`, `scripts/build-bundle.sh`, `bundle-manifest.json` | 1.5   | Open     | 2026-11-15 | 2026-11-15 | —    |
| RF-005 | R2  | Test helpers redefined in each test file                           | `test/unit` (`read`, `ROOT`, `stripFrontmatter`, section helpers)                  | 1.3   | Open     | 2026-11-15 | 2026-11-15 | —    |
| RF-006 | R8  | Deploy ref-rule test depends on the checkout's HEAD                | `test/unit/infra-script-contract.test.ts`                                          | 1.0   | Open     | 2026-11-15 | 2026-11-15 | —    |
| RF-007 | R2  | `git-guard` logic repeated across Claude and Kiro hooks            | `.claude/hooks/git-guard.sh`, `.kiro/hooks/scripts/git-guard.sh`                   | 0.8   | Open     | 2026-11-15 | 2026-11-15 | #340 |
| RF-008 | R8  | Parity tests pin whole sentences of prompt prose                   | `test/unit/*parity*.test.ts`                                                       | 0.8   | Open     | 2026-11-15 | 2026-11-15 | —    |
| RF-009 | R4  | `main` in `bin/dev-tasks.ts` holds every command inline            | `bin/dev-tasks.ts` `main`                                                          | 0.5   | Open     | 2026-11-15 | 2026-11-15 | —    |
| RF-010 | R4  | Very long functions in `core/migrate-projects`                     | `core/migrate-projects` (`planMigration`, `runRow`, `parseMigrationPlan`)          | 0.2   | Deferred | 2026-11-15 | 2026-11-15 | —    |
| RF-011 | R5  | Dead exports, deprecated `installSkills`, tracked `dist/` tarballs | `core/distribution/install.ts`, `core/migrate-projects`, `dist/`                   | 1.0   | Deferred | 2026-11-15 | 2026-11-15 | —    |
| RF-012 | R3  | Dependency-direction test guards a directory that is gone          | `test/unit/dependency-direction.test.ts`                                           | 1.0   | Deferred | 2026-11-15 | 2026-11-15 | —    |
| RF-013 | R6  | Check finding type declared three times                            | `core/checks` (`docs-structure`, `decision-log-format`, `glossary`)                | 0.5   | Deferred | 2026-11-15 | 2026-11-15 | —    |

RF-010 to RF-013 are deferred by rule: no change could be named that they make harder (Friction 1). They are re-checked on every `full` run.
