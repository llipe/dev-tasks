---
name: supabase-ops
description: "Supabase CLI command sets, db diff migration flow, drift rule, backup/revert sources, inventory findings, and Cloud log table for infra-engineer. Use when planning or applying Supabase infrastructure changes."
---

# Supabase Operations (supabase-ops)

Per-surface mechanism skill for `infra-engineer`. It supplies the Supabase CLI command sets, resource tiers, the `db diff` migration flow, the drift rule, backup and revert sources, inventory findings, and the Supabase Cloud log table. It does not restate the agent's working loop, approval, revert, or backup rules — those live in the agent body. Supabase is the one platform with a genuine plan mechanism (`db diff`), and its keys are the highest-value secrets in the stack.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Tool declaration

| Field         | Value                                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | `supabase`                                                                                                                                                                                                |
| `probe`       | `supabase --version` (expects `2.x`)                                                                                                                                                                      |
| `floor`       | Supabase CLI `2.x`; minimum `2.11`. A `1.x` install is `below-floor`.                                                                                                                                     |
| `auth_probe`  | `supabase projects list`                                                                                                                                                                                  |
| `remediation` | "Install Supabase CLI v2 and run `supabase login` (or export `SUPABASE_ACCESS_TOKEN`); link the project with `supabase link --project-ref <ref>`. This skill never auto-installs and offers no fallback." |

Identity is asserted by comparing the linked project ref (from `supabase projects list` / the linked `project_ref`) with the target environment's `supabase.project_ref`; a mismatch is `wrong-identity` and blocks.

## Resource tiers

| Tier            | Supabase resources                                                                    |
| --------------- | ------------------------------------------------------------------------------------- |
| **foundation**  | project, plan, compute add-on, read replicas, PITR                                    |
| **application** | schema, migrations, RLS policies, roles, storage buckets, auth config, Edge Functions |
| **ephemeral**   | preview branches, which carry an `ExpiresAt` tag and a cleanup step                   |

Foundation changes are routed to `tier0_tool`, never written by this agent. Project deletion is refused for a production-mapped project.

## Migration flow (db diff as plan)

1. `supabase db diff -f "$NAME"` produces the migration SQL — this **is** the plan. Do not push before it is reviewed.
2. **Destructive statements** (`DROP`, `TRUNCATE`, `ALTER ... DROP COLUMN`, type narrowing) are itemized separately in `plan.md`, each as its own line requiring named approval.
3. Confirmation is required before `supabase db push` to any shared or production project. The push runs only after the human approves that step.
4. Verification: `supabase migration list` shows the new migration applied on the remote.
5. **Drift rule:** a non-empty `supabase db diff` against the remote with **no pending local migration** is reported as drift and **never pushed**. Drift is reported, never reconciled by pushing. The agent records the drift in `result.md` and stops.

```sh
supabase db diff -f add_orders_table            # plan
# review the generated migration; itemize destructive statements
supabase db push                                # apply, only after confirmation
supabase migration list                         # verify
```

## Backup

Before any production step touching schema or data, record a backup: `supabase db dump -f backup.sql --data-only` (and a schema dump) **or** a recorded PITR restore point when PITR is enabled on the project. The backup artifact reference and the restore command are recorded in `result.md` before the step applies. Revert of a schema change is a forward migration that reverses it, applied through the same confirmed flow; there is no silent `db reset` against a shared project.

## Discovery order

Discovery prefers **Supabase MCP read-only** when present, then the **CLI**, then the **Management API**, and records which path was used in the inventory `_generated` block. Writes never go through MCP — MCP is read-only for discovery only. No MCP write, ever.

## Inventory and findings

Inventory files under `infra/inventory/supabase/<ref>.json` carry the standard `_generated` header and these fields:

- `has_legacy_keys: bool` — reported as a finding when legacy (pre-publishable/secret) keys are still in use.
- `rls_disabled_tables: []` — tables with row-level security disabled, reported as findings.

Inventory contains **no key material**, masked or otherwise. Reporting `has_legacy_keys` or `rls_disabled_tables` never includes the key or a sample row.

## Secrets

- Edge Function secrets are set with `supabase secrets set KEY=value` / `supabase secrets unset KEY`, from the source of truth, never a transcript.
- **Publishable versus secret keys** are distinguished at every reference: a `sb_publishable_*` key is client-safe; a `sb_secret_*` key and the `service_role` JWT are server-only and never leave a secret store.
- No AWS Secrets Manager entry for a Supabase-only workload; Supabase secrets stay on Supabase.

## Supabase Cloud log table

Retrieval, retention, and query bounds are grounded in `workstream/research-supabase-logs.md` (researcher pass, 2025-09-12). Key facts cited from that artifact:

- **The Supabase CLI has no log command on Cloud.** The scriptable path is the Management API logs endpoint `GET /v1/projects/{ref}/analytics/endpoints/logs`, which runs a ClickHouse-dialect SQL/LQL query over a unified logs stream filtered by a `source` column; the Dashboard Logs Explorer is the interactive equivalent. `supabase inspect db ...` is Postgres diagnostics, not service logs.
- **Time bounds are mandatory in practice:** the endpoint uses `iso_timestamp_start` / `iso_timestamp_end`, the window MUST be ≤ 24 hours, and an omitted range queries only the last minute — so every triage query states an explicit UTC window before it runs.

| Service surface | Source selector / collection                                  | Retrieval path                          |
| --------------- | ------------------------------------------------------------- | --------------------------------------- |
| Postgres        | `source = postgres_logs`                                      | Management API logs endpoint; Dashboard |
| API (PostgREST) | API Gateway collection                                        | Management API logs endpoint; Dashboard |
| Auth (GoTrue)   | Auth collection                                               | Management API logs endpoint; Dashboard |
| Storage         | Storage collection                                            | Management API logs endpoint; Dashboard |
| Realtime        | Realtime collection                                           | Management API logs endpoint; Dashboard |
| Edge Functions  | `source = edge_logs` / `function_edge_logs` / `function_logs` | Management API logs endpoint; Dashboard |

**Retention caveat (cite the research artifact, re-confirm at citation time):** built-in log retention is short and plan-gated — Free ≈ 1 day, Pro ≈ 7 days, Team ≈ 28 days, Enterprise ≈ 90 days. Because low-tier retention is short, logs MUST be captured at incident time; Log Drains (Team/Enterprise) is the long-retention path. Exact `source` strings for API/Auth/Storage/Realtime are UNCONFIRMED in the research and must be verified from the Logs Explorer source list before hardcoding. All log output passes through the redaction pattern set before it reaches a transcript or file.

## Cost entries and sweep

Cost entries listed on every Supabase plan:

- **Plan** tier (Free/Pro/Team/Enterprise) base.
- **Compute** add-on size.
- **Read replicas**.
- **PITR** add-on.
- **Preview branches**.
- **Egress**.

Sweep categories (read-only, reported never remediated):

- Preview branches past their `ExpiresAt` tag.
- Preview branches without any `ExpiresAt` tag.
- Paid but idle projects.
- Read replicas with no traffic.
- PITR enabled on a non-production project.
