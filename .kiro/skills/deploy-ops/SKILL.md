---
name: deploy-ops
description: "Deploy script contract, environment mapping, tag policy, deploy-target framing, and workflow scaffolding for infra-engineer. Use when planning or applying deploys, rollbacks, or releases."
---

# Deploy Operations (deploy-ops)

Cross-surface mechanism skill for `infra-engineer`. It supplies the deploy **script contract**, the environment mapping table, the tag policy summary, the deploy-target framing, and the workflow scaffolding procedure. It does not restate the agent's working loop, approval, revert, or backup rules — those live in the agent body — and it contains no deploy logic itself: the logic lives in the `templates/scripts/*.sh` files, which this skill only documents and wires. The skill declares the tools `yq` and `gh`.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Tool declaration

| Field         | Value                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `name`        | `yq`, `gh`                                                                                                                |
| `probe`       | `yq --version`; `gh --version`                                                                                            |
| `floor`       | `yq` 4.x (the mikefarah Go implementation); minimum `4.0`. A 3.x or Python `yq` is `below-floor`. `gh` any current 2.x.   |
| `auth_probe`  | `gh auth status` (for release/PR operations); `yq` needs no auth.                                                         |
| `remediation` | "Install `yq` 4.x from mikefarah/yq and `gh` from cli.github.com; this skill never auto-installs and offers no fallback." |

`yq` reads and resolves `infra/environments.yaml`; `gh` performs release and PR operations for the release flow. Every command references secrets by name, never by value, and every log or status query passes through the redaction pattern set before it reaches a transcript.

## Script contract

The deploy surface is a fixed set of `bash` scripts under `templates/scripts/`. Each is `set -euo pipefail`, supports `--help`, reads the environment definition from `infra/environments.yaml` via `yq`, and contains no environment names or secrets of its own.

| Script             | Purpose                                                      | Mutates? | `--dry-run` | Exit codes                                 |
| ------------------ | ------------------------------------------------------------ | -------- | ----------- | ------------------------------------------ |
| `deploy.sh`        | Ordered deploy pipeline for one environment                  | yes      | yes         | 0 ok · 1 error · 2 blocked · 3 verify-fail |
| `deploy-verify.sh` | Post-deploy health check; prints the rollback line on fail   | no       | no          | 0 healthy · 2 blocked · 3 fail             |
| `rollback.sh`      | Roll back to the previous good version from `infra/changes/` | yes      | yes         | 0 ok · 1 error · 2 blocked                 |
| `deploy-status.sh` | Read-only current status of an environment                   | no       | n/a         | 0 ok · 2 blocked                           |
| `release.sh`       | Generalized changelog/version/tag/push release automation    | yes      | yes         | 0 ok · 1 error · 2 blocked                 |

### `deploy.sh` ordered steps

`deploy.sh <env>` runs eight ordered steps and exits `2` on any blocked condition:

1. **preflight** — clean tree, ref rules, identity assertion.
2. **validate** — the project quality gate; **never** skippable by any flag.
3. **build** — artifact tagged `vX.Y.Z` (production) or `main-<short-sha>` (non-production).
4. **backup** — taken when the environment is production **and** the change migrates; **never** skipped for production.
5. **migrate** — with explicit confirmation for production.
6. **deploy** — via the detected deploy kind.
7. **verify** — delegates to `deploy-verify.sh`.
8. **record** — appends a change record under `infra/changes/`.

No `latest` mutable tag is ever a deploy target. The deploy kind is detected from the platform blocks present in the environment; `deploy.sh` refuses (`exit 2`) when the detection is ambiguous (more than one platform block and no explicit `deploy_kind`), per spec open question 3.

### Failure and rollback

`deploy-verify.sh` exits `3` on a failed health check and prints the exact `rollback.sh <env>` invocation to run next. `rollback.sh <env>` resolves the previous good version from `infra/changes/` with no manual lookup; `--to <version>` overrides the resolved version.

## Environment mapping table

Environment names and platform blocks are read from `infra/environments.yaml` via `yq`. A missing or template-status (`# status: template`) file exits `2`.

| Trigger / ref                | Environment | Rule                                                                          |
| ---------------------------- | ----------- | ----------------------------------------------------------------------------- |
| push to `main`               | `dev`       | non-production deploys `main` HEAD; artifact tagged `main-<short-sha>`        |
| annotated tag `vX.Y.Z`       | `prod`      | production refuses any ref that is not an annotated tag on `main`             |
| manual (`workflow_dispatch`) | any         | dev is optional; installed only when a `production: false` environment exists |

## Tag policy summary

Tags are human-only and owned by the policy in `github-ops`: annotated `vX.Y.Z`, created on `main` only, immutable, no prerelease in v1. `deploy-ops` never creates, moves, or deletes a tag — `git-guard` rule 4 blocks agent tag operations deterministically. `release.sh` suggests the bump type from Conventional Commits and confirms it; production deploys consume the resulting annotated tag.

## Deploy-target framing

`deploy-ops` does not choose the platform for a consumer. It frames the decision so the operator (or `infra-engineer`) picks a **deploy target** deliberately, then records the choice in `infra/environments.yaml`.

| Decision input   | Question the operator answers                                        |
| ---------------- | -------------------------------------------------------------------- |
| compute platform | fly.io app, AWS ECS service, or another target?                      |
| data platform    | is there a Supabase (or other) migration step to sequence?           |
| environment tier | is this environment `production: true` or `false`?                   |
| ref discipline   | does production consume an annotated tag, and does dev track `main`? |
| rollback source  | is the previous good version recorded in `infra/changes/`?           |

When two platform blocks are present with no explicit `deploy_kind`, the deploy target is ambiguous and `deploy.sh` refuses until the operator sets `deploy_kind`.

## Workflow scaffolding procedure

`deploy-ops` scaffolds the GitHub Actions workflow templates (`templates/workflows/`) into a consumer repo as recorded changes delivered by a draft PR — never applied silently.

1. Read `infra/environments.yaml`.
2. Install `deploy-dev.yml` **only when** an environment with `production: false` is declared.
3. Install `deploy-prod.yml` (triggered on the exact-semver tag, behind a required reviewer) and `rollback.yml` (`workflow_dispatch`) when a `production: true` environment exists.
4. Every workflow calls the canonical scripts only — no inline deploy logic.
5. Workflow edits are recorded changes; they are delivered by PR and reviewed by a human.

## `package.json` wrappers for JS/TS repos

For JavaScript/TypeScript repos only, `deploy-ops` generates thin `package.json` script wrappers so the deploy surface is reachable through the project's canonical script runner. The shell scripts remain the implementation; the wrappers are one-line delegations:

```jsonc
{
  "scripts": {
    "deploy": "bash templates/scripts/deploy.sh",
    "deploy:verify": "bash templates/scripts/deploy-verify.sh",
    "deploy:rollback": "bash templates/scripts/rollback.sh",
    "deploy:status": "bash templates/scripts/deploy-status.sh",
    "release": "bash templates/scripts/release.sh",
  },
}
```

Non-JS/TS repos call the scripts directly; no wrapper is generated.

## Human-only guard

`release.sh` and `deploy.sh prod` refuse to run when `CI` is set without `INFRA_HUMAN_APPROVED=1` exported by the protected-environment job, and refuse in a non-interactive agent context. This keeps release and production deploy decisions with a human even when the scripts run inside automation.

## Boundary rules

- No deploy logic lives in this skill or in a workflow; it lives only in `templates/scripts/*.sh`.
- No deploy targets a mutable `latest` tag.
- The agent never creates tags; tags are human-only per `github-ops`.
