---
name: fly-ops
description: "flyctl command sets, resource tiers, cost inputs, backup and revert sources, and log table for infra-engineer. Use when planning or applying fly.io infrastructure changes."
---

# Fly.io Operations (fly-ops)

Per-surface mechanism skill for `infra-engineer`. It supplies the `flyctl` command sets, resource tiers, cost inputs, backup and revert sources, and the fly.io log table. It does not restate the agent's working loop, approval, revert, or backup rules — those live in the agent body. fly.io has release history (`fly releases`) that makes revert concrete and volume snapshots that make backup concrete, so it is the cheapest surface for the manual Phase 1 verification.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Tool declaration

| Field         | Value                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | `flyctl`                                                                                                                                       |
| `probe`       | `flyctl version`                                                                                                                               |
| `floor`       | Current major release channel; minimum `0.3`. An older channel is `below-floor`.                                                               |
| `auth_probe`  | `flyctl auth whoami`                                                                                                                           |
| `remediation` | "Install `flyctl` from fly.io and run `flyctl auth login` (or export `FLY_API_TOKEN`); this skill never auto-installs and offers no fallback." |

Use `--json` wherever `flyctl` supports it. Identity is asserted by comparing the authenticated org (from `flyctl auth whoami` / `flyctl orgs list --json`) with the target environment's `fly.org`; a mismatch is `wrong-identity` and blocks.

## Resource tiers

| Tier            | Fly resources                                                     |
| --------------- | ----------------------------------------------------------------- |
| **foundation**  | org                                                               |
| **application** | app, machine, volume, secret, certificate                         |
| **ephemeral**   | throwaway apps, which carry an `ExpiresAt` tag and a cleanup step |

An ephemeral app without an `ExpiresAt` is a finding. Foundation (org) changes are routed, never written by this agent.

## Command sets per change kind

Every command references secrets by name, never by value.

### Discover (read-only)

```sh
flyctl auth whoami
flyctl apps list --json
flyctl status -a "$APP" --json
flyctl machine list -a "$APP" --json
flyctl volumes list -a "$APP" --json
flyctl secrets list -a "$APP"
flyctl certs list -a "$APP"
flyctl releases -a "$APP" --json
```

### Create app

- Forward: `fly apps create "$APP" --org "$ORG"`
- Verify: `flyctl status -a "$APP" --json`
- Revert: `fly apps destroy "$APP" --yes` (requires the typed app name and environment name per the agent body).

### Deploy

- Forward: `fly deploy -a "$APP" --image "$IMAGE"` or a build then deploy:
  ```sh
  fly deploy -a "$APP" --build-only --push --image-label "$TAG"
  fly deploy -a "$APP" --image "registry.fly.io/$APP:$TAG"
  ```
- Verify: `flyctl status -a "$APP" --json` shows the new release healthy.
- Revert: `fly deploy -a "$APP" --image <previous>` using the previous image from `fly releases`.

### Secrets

- Forward: `fly secrets set KEY=value -a "$APP"` (value from its source of truth, never a transcript) / `fly secrets unset KEY -a "$APP"`.
- Revert: re-set the prior value from its source of truth; **never** reconstruct a secret from a transcript or log.

### Volumes

- Forward: `fly volumes create "$NAME" -a "$APP" --region "$REGION" --size "$GB"`.
- Backup: `fly volumes snapshots create "$VOL_ID"` before any production step touching a volume.
- Revert: restore from the recorded snapshot; `fly volumes destroy "$VOL_ID"` only after the typed confirmation.

### Certificates

- Forward: `fly certs add "$FQDN" -a "$APP"`; then `fly certs check "$FQDN" -a "$APP"`.
- Revert: `fly certs remove "$FQDN" -a "$APP" --yes`.

### Scale and machines

```sh
fly scale count "$N" -a "$APP"
fly scale vm "$SIZE" -a "$APP"
fly machine status "$MACHINE" -a "$APP" --json
```

Revert for a scale change is the prior count/size recorded before the step.

### Destroy

`fly apps destroy "$APP" --yes` requires the operator to type both the app name and the environment name. A production foundation target is refused.

## Revert sources

- **Deploy:** `fly releases -a "$APP" --json` supplies the previous image; revert is `fly deploy --image <previous>`.
- **Secret:** re-set the prior value from its source of truth.
- **Volume:** the snapshot recorded as backup.
- **Scale/cert:** the prior value/record captured before the step.

## Backup

`fly volumes snapshots create "$VOL_ID"` runs before any production step that touches a volume; the snapshot id and the restore command are recorded in `result.md` before the step applies.

## Fly log table

Every query is time-bounded and its output passes through the redaction pattern set before it reaches a transcript or file.

| Source          | Command                                   |
| --------------- | ----------------------------------------- |
| App logs        | `fly logs -a "$APP" --since "$START"`     |
| App status      | `fly status -a "$APP" --json`             |
| Machine status  | `fly machine status "$MACHINE" -a "$APP"` |
| Release history | `fly releases -a "$APP" --json`           |

## Cost entries and sweep

Cost entries listed on every fly plan:

- **Machines** by size (shared/performance vCPU + memory).
- **Volumes** by GB.
- **Dedicated IPv4** addresses.

Sweep categories (read-only, reported never remediated):

- Stopped machines still holding volumes.
- Unattached volumes.
- Apps past their `ExpiresAt` tag.

## Boundary rules

- No AWS Secrets Manager entry for a fly-only workload; fly secrets stay on fly.
- `fly apps destroy` requires the typed app name and environment name.
