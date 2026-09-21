# Runbooks

Operational procedures for this repository. Each file states preconditions,
steps, verification, rollback, and escalation — the five headings are fixed
(FR-48) so a reader knows where to look before they open the file.

A runbook describes a procedure that is current. When the script or workflow
it documents is retired, the runbook is retired with it
(`SIMPLICITY.md` A10) rather than kept as history.

`test/unit/runbook-set.test.ts` enforces two things worth knowing about: this
index must list exactly the runbooks on disk, and every file under
`templates/scripts/`, `templates/workflows/`, and `.github/workflows/` must be
named by some runbook's `related` field. A new script without a runbook fails
the suite.

To add one: copy `templates/runbooks/runbook-template.md`, fill it in, add a
row here, and add its slug to `EXPECTED_RUNBOOKS` in the test.

| Runbook                                                                          | Trigger                                                                                                                    | Owner          | Last verified |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------- |
| [runbook-configure-branch-protection.md](runbook-configure-branch-protection.md) | dev-tasks was just installed, or an agent is about to get write access to a repository whose default branch is unprotected | github-ops     | 2026-09-19    |
| [runbook-deploy-service.md](runbook-deploy-service.md)                           | A change is ready to reach a running environment                                                                           | infra-engineer | 2026-09-19    |
| [runbook-install-dev-tasks.md](runbook-install-dev-tasks.md)                     | A repository needs the toolkit for the first time, or an install moves to a different profile                              | developer      | 2026-09-19    |
| [runbook-migrate-foundation-docs.md](runbook-migrate-foundation-docs.md)         | A repository still carries the pre-rename foundation document names                                                        | developer      | 2026-09-19    |
| [runbook-release-npm.md](runbook-release-npm.md)                                 | Merged changes should be published to npm and GitHub Releases                                                              | infra-engineer | 2026-09-19    |
| [runbook-retire-dt.md](runbook-retire-dt.md)                                     | A consumer still carries the retired `dt` multi-repo context layer                                                         | developer      | 2026-09-19    |
| [runbook-rollback-deploy.md](runbook-rollback-deploy.md)                         | A deploy failed verification, or a deployed change is causing incidents                                                    | infra-engineer | 2026-09-19    |
| [runbook-setup-simplicity-tooling.md](runbook-setup-simplicity-tooling.md)       | A repository wants SIMPLICITY.md's section D thresholds enforced by CI                                                     | housekeeping   | 2026-09-19    |
| [runbook-setup-supabase-local.md](runbook-setup-supabase-local.md)               | A developer needs a local Supabase stack for migrations or RLS work                                                        | infra-engineer | 2026-09-19    |
| [runbook-troubleshoot-hooks.md](runbook-troubleshoot-hooks.md)                   | A guard hook blocked something it should not have, or missed something it should have caught                               | developer      | 2026-09-19    |
