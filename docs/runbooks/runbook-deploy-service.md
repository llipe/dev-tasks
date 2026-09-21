---
name: runbook-deploy-service
trigger: A change is ready to reach a running environment — a dev deploy after merge, or a production deploy of a tagged release.
owner: infra-engineer
last_verified: 2026-09-19
related:
  [
    "templates/scripts/deploy.sh",
    "templates/scripts/deploy-verify.sh",
    "templates/scripts/deploy-status.sh",
    "templates/workflows/deploy-dev.yml",
    "templates/workflows/deploy-prod.yml",
  ]
---

# Deploy a service to an environment

`deploy.sh` runs a fixed, ordered pipeline against one environment defined in
`infra/environments.yaml`. It contains no environment names or secrets of its
own — everything specific to your setup lives in that file.

The order is: preflight, validate, build, backup, migrate, deploy, verify,
record. It is fixed on purpose. `validate` is never skippable, and for
production a change that migrates is never deployed without a backup first.

## Preconditions

- `infra/environments.yaml` exists and is not the shipped template. The
  script exits `2` on a template it recognizes as unfilled.
- `yq` is on `PATH`. The script reads the environment definition with it and
  exits `2` without it.
- A clean working tree, and a ref the environment allows. Production refuses
  any ref that is not an annotated tag on the default branch.
- For production under CI: `INFRA_HUMAN_APPROVED=1`. A production deploy is a
  human decision even when a workflow runs it.
- Know the current state before changing it:

  ```bash
  ./scripts/deploy-status.sh prod
  ```

## Steps

1. Print the ordered command sequence without mutating anything:

   ```bash
   ./scripts/deploy.sh dev --dry-run
   ```

   Read it. This is the only step where a surprise is free.

2. Deploy to the lower environment first:

   ```bash
   ./scripts/deploy.sh dev
   ```

3. Confirm the change in `dev` before promoting it. A production deploy of
   something that was never exercised in `dev` is a rollback waiting to
   happen.

4. Deploy to production from an annotated tag:

   ```bash
   ./scripts/deploy.sh prod
   ```

   When the change migrates, the script takes a backup before migrating and
   asks for explicit confirmation. Answer it deliberately; that prompt is the
   last point where stopping is cheap.

5. In CI, the same scripts run from `templates/workflows/deploy-dev.yml` and
   `templates/workflows/deploy-prod.yml`. They are thin wrappers — the
   pipeline and its guards live in the script, not the workflow, so local and
   CI deploys behave identically.

## Verification

`deploy.sh` runs `deploy-verify.sh` itself as step 7 and fails the deploy
with exit `3` when the health check fails. Confirm independently:

```bash
./scripts/deploy-verify.sh prod   # exit 0 = healthy
./scripts/deploy-status.sh prod   # deployed version and platform status
cat infra/changes/$(ls -t infra/changes | head -1)
```

The status output names the version you just deployed, and the newest change
record describes this deploy. `deploy-status.sh` is read-only and safe to run
at any time.

## Rollback

On a failed verify the script prints the exact rollback invocation. Run it:

```bash
./scripts/rollback.sh prod
```

See `runbook-rollback-deploy.md` for the full procedure, including how the
previous good version is resolved and what a migration does to the rollback
path.

## Escalation

Exit `2` is a guard refusal, not a failure — read which precondition it
names and satisfy it rather than working around it. Exit `3` is a real
health-check failure: roll back first, diagnose second, and bring in the
service owner with the change record and the verify output. A deploy that
succeeded but left the service unhealthy in a way the health check misses is
a gap in the health check; file it as one.
