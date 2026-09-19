---
name: runbook-rollback-deploy
trigger: A deploy failed verification, or a deployed change is causing incidents and the previous version must be restored.
owner: infra-engineer
last_verified: 2026-09-19
related: ["templates/scripts/rollback.sh", "templates/workflows/rollback.yml"]
---

# Roll an environment back to the last known-good version

`rollback.sh` resolves the previous good version from the change history
under `infra/changes/` — no manual lookup, no guessing which build was fine.
Restoring service comes first; the root cause can wait.

## Preconditions

- `infra/changes/` holds at least one recorded good deploy for this
  environment. Without one the script exits `2` rather than picking a
  version for you, and you must pass `--to <version>` explicitly.
- You know whether the bad deploy ran a migration. If it did, rolling the
  application back does not roll the schema back — see Rollback below, and
  decide before you start.
- For production, the same human-approval guard as a deploy applies.

## Steps

1. Establish what is running now:

   ```bash
   ./scripts/deploy-status.sh prod
   ```

2. Preview the rollback, including which version it resolved to:

   ```bash
   ./scripts/rollback.sh prod --dry-run
   ```

3. Roll back:

   ```bash
   ./scripts/rollback.sh prod
   ```

   To override the resolved target:

   ```bash
   ./scripts/rollback.sh prod --to 1.4.2
   ```

4. `templates/workflows/rollback.yml` runs the same script from CI when you
   cannot get to a terminal. It takes the environment and optional target
   version as inputs.

## Verification

```bash
./scripts/deploy-verify.sh prod
./scripts/deploy-status.sh prod
```

Verify exits `0` and status reports the version you rolled back to. If
verify still fails after a successful rollback, the problem is not the
version you just removed — stop rolling and escalate.

## Rollback

Rolling back a rollback is a forward deploy of the newer version:

```bash
./scripts/deploy.sh prod
```

A schema migration is the exception and the thing to be careful about. A
migration is not undone by deploying older application code. Reversing it is
a forward migration that reverses it, applied through the normal confirmed
flow — never a `db reset` against a shared project. If the bad deploy
migrated, plan the reversing migration before rolling the application back,
or you will be running old code against a new schema.

## Escalation

Exit `2` with no recorded good version means the change history is missing or
was never written — escalate to whoever owns the environment and roll back
manually via the platform console, then repair the history. During an
incident, page the service owner in parallel with the rollback rather than
after it; the rollback does not need their approval, and the diagnosis needs
them.
