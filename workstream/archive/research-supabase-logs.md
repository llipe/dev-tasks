# Research: Supabase Cloud Log Retrieval & Per-Plan Retention

## Changelog

| Version | Date       | Summary                                                    | Author     |
| ------- | ---------- | ---------------------------------------------------------- | ---------- |
| 1.0     | 2025-09-12 | Initial research artifact for `infra-engineer` log table   | researcher |

## Provenance

- **Repository:** dev-tasks (`github.com/llipe/dev-tasks`)
- **Base branch:** `issue/153-branch-convention-hygiene`
- **Commit SHA:** `e47e885763c4de5c7f89b4dad612eacf8c670d84`
- **Invoking agent:** user (standalone research, to inform `infra-engineer` `supabase-ops` skill)
- **Research question:** How are Supabase Cloud logs retrieved per service surface (CLI-first, then Management API, then Dashboard), what is per-plan log retention, and what query/time-bounding parameters bound a redacted log-triage query?
- **Date:** 2025-09-12
- **Multi-repo source:** direct scanning (no `component.json`); external documentation + local `supabase` CLI v2.116.0 introspection
- **Network:** available. Sources verified live (see External sources).

## Answer first

- **CLI is NOT the primary log-retrieval path on Cloud.** The installed `supabase` CLI v2.116.0 exposes **no `logs` command** and `supabase functions` has **no `logs` subcommand**. `supabase inspect db` provides Postgres *diagnostics* (stats, locks, outliers) — snapshots, not service logs.
- **Primary programmatic path is the Management API Logs endpoint:** `GET /v1/projects/{ref}/analytics/endpoints/logs` — runs an SQL/LQL query (ClickHouse SQL dialect) against the project's **unified logs stream**, filtered by a `source` column (`edge_logs`, `postgres_logs`, etc.). All six service surfaces are reachable this way.
- **Dashboard Logs Explorer** is the interactive equivalent (single-service collections: API Gateway, Postgres, Auth, Storage, Realtime, Edge Functions).
- **Retention by plan (from pricing comparison table): Free = 1 day, Pro = 7 days, Team = 28 days, Enterprise = 90 days.** Row is labelled "Log retention (API & Database)". Longer retention/export requires **Log Drains** (Team/Enterprise). Because lower tiers retain very little, **logs must be captured at incident time**.
- **Time-bounding:** the API requires `iso_timestamp_start`/`iso_timestamp_end`; range **must be ≤ 24 hours**, rounded to the nearest minute; if omitted, **only the last 1 minute** is queried.

## Relevance-ranked file map

External-documentation research — not a codebase question. No repository source files are cited. Local evidence is CLI introspection output (see S2). Target consumer file: a future `infra-engineer` `supabase-ops` skill log table.

## Slice findings

### S1 — Components / modules
`N/A` — no owning module in this repository; the deliverable is a future skill file. Service surfaces in scope: Postgres/database, PostgREST (API Gateway), Auth (GoTrue), Storage, Realtime, Edge Functions.

### S2 — APIs and contracts (retrieval surfaces)

**CLI (`supabase` v2.116.0, local introspection):**
- Top-level commands include `functions`, `inspect`, `db`, `projects`, `services` — **no `logs`**.
- `supabase functions` subcommands: `list` (no `logs`).
- `supabase inspect db <sub>`: `db-stats`, `locks`, `blocking`, `outliers`, `calls`, `long-running-queries`, `table-stats`, etc. — Postgres **diagnostics**, not log streaming.
- Implication: **CLI cannot retrieve service logs for a Cloud project** in this version. (Older docs/versions referenced a `supabase functions logs`-style flow; UNCONFIRMED for v2 — see Caveats.)

**Management API — `GET /v1/projects/{ref}/analytics/endpoints/logs` (verified):**
- "Executes an SQL or LQL query on the project's **unified logs stream**."
- Filter by the `source` column to select surfaces, e.g. `edge_logs`, `postgres_logs`. Confirmed source identifiers seen in docs: `edge_logs`, `postgres_logs`, `function_edge_logs`, `function_logs`.
- SQL must be **ClickHouse SQL dialect**.
- Requires OAuth scope `analytics:read` (fine-grained token permission `analytics:read`).
- All service surfaces (Postgres, PostgREST/API gateway, Auth, Storage, Realtime, Edge Functions) are queryable via `source` selectors on this unified endpoint.

**Dashboard — Logs Explorer (verified):**
- Interactive SQL over the same logs; sidebar lists **single-service collections** ("API Gateway", "Postgres", etc.). With Read Replicas, a `Source` control filters by database.
- Dashboard-only convenience; no unique log data unavailable to the API.

**Reachability summary:**

| Surface           | CLI (v2.116.0)      | Management API (`.../analytics/endpoints/logs`) | Dashboard Logs Explorer |
| ----------------- | ------------------- | ----------------------------------------------- | ----------------------- |
| Postgres/database | Diagnostics only¹   | Yes (`source=postgres_logs`)                    | Yes                     |
| PostgREST API     | No                  | Yes (API gateway source)²                       | Yes (API Gateway)       |
| Auth (GoTrue)     | No                  | Yes (auth source)²                              | Yes (Auth)              |
| Storage           | No                  | Yes (storage source)²                           | Yes (Storage)           |
| Realtime          | No                  | Yes (realtime source)²                          | Yes (Realtime)          |
| Edge Functions    | No (`functions` has no `logs`) | Yes (`edge_logs`/`function_edge_logs`/`function_logs`) | Yes (Edge Functions)    |

¹ `supabase inspect db` = live diagnostics, not historical logs.
² Exact `source` string for PostgREST/Auth/Storage/Realtime not fully enumerated in rendered docs — confirmed names are `edge_logs`, `postgres_logs`, `function_edge_logs`, `function_logs`. Others UNCONFIRMED (see Caveats).

### S3 — UI surfaces
Dashboard **Logs Explorer** (`Project → Logs`) is the UI surface: per-service collections, JSON row expansion, SQL editor. `/DESIGN.md` is a placeholder and not relevant here. Otherwise `N/A`.

### S4 — Tests
`N/A` — documentation research; no tests in scope.

### S5 — Data model
Logs are exposed as a queryable **unified logs stream** with a `source` discriminator column and nested `log_attributes` (e.g. `log_attributes['load_balancer...']` for API load-balancer routing). Full column schema per source not enumerated here.

### S6 — Config / env / CI
- Access needs a Supabase **access token / fine-grained token** with `analytics:read` (Management API) and the project `ref`.
- **Log Drains** (export to external sinks for longer retention/compliance) are a **Team/Enterprise** platform feature — the mechanism to exceed built-in retention.

### S7 — Relationships
Consumer: future `infra-engineer` `supabase-ops` skill log table. Producer of facts: Supabase docs + local CLI. Blast radius: none in this repo (read-only artifact under `/workstream`).

### S8 — Prior history
No prior `/workstream/research-*.md` on Supabase logging found. First artifact on this topic.

## Relationships

The `supabase-ops` skill's log table should route retrieval to: **(1) Management API logs endpoint** as the scriptable path, **(2) Dashboard Logs Explorer** for interactive triage, and treat the **CLI as diagnostics-only** for Postgres. Retention drives urgency: capture at incident time on Free/Pro.

## Risks and gotchas

- **Do not assume `supabase logs` exists** — it does not in v2.116.0. A skill that shells out to a CLI `logs` command will fail on Cloud.
- **24-hour max query window** on the API; a triage query spanning more must be chunked.
- **Default 1-minute window** if timestamps omitted — easy to silently retrieve almost nothing.
- **ClickHouse SQL dialect**, not Postgres SQL — query syntax differs.
- **Low-tier retention (Free = 1 day)**: post-incident forensics are often impossible; capture immediately or configure a Log Drain (Team/Enterprise) beforehand.
- **Redaction:** logs may contain PII / tokens in `log_attributes` — a log-triage query MUST scope columns and redact before sharing (per repo untrusted-input rules; reference secrets by key name only).

## External sources

- Management API — Get project logs: <https://supabase.com/docs/reference/api/v1-get-project-logs> (verified: unified logs stream, `source` filter, ClickHouse SQL, ≤24h range, 1-min default, `analytics:read` scope).
- Observability → Logs (Logs Explorer, single-service collections): <https://supabase.com/docs/guides/observability/logs> ("Log retention is based on your project's pricing plan").
- Observability → Log Drains: <https://supabase.com/docs/guides/observability/log-drains> (export for longer retention/compliance).
- Pricing (retention comparison row "Log retention (API & Database)": **1 day / 7 days / 28 days / 90 days**; plan-card bullets "7-day log retention", "28-day log retention"): <https://supabase.com/pricing>.
- Local: `supabase --version` → **2.116.0**; `supabase --help`, `supabase functions --help`, `supabase inspect db --help`.

## Not investigated

- Exact `source` string identifiers for PostgREST, Auth, Storage, and Realtime (only `edge_logs`, `postgres_logs`, `function_edge_logs`, `function_logs` were explicitly confirmed in rendered docs).
- Full column schema of each log source.
- Whether any experimental/older CLI path (`supabase functions logs`) exists in other CLI versions.
- Log Drain destination catalog and pricing detail.
- Self-hosted (non-Cloud) log paths — out of scope (Cloud only).

## Confidence

**Medium-High.** Retrieval mechanism (API endpoint, no CLI `logs`, dashboard), query/time-bounding parameters, and the four per-plan retention numbers are directly verified from live authoritative Supabase sources. Deductions marked UNCONFIRMED are the exact per-service `source` strings for four surfaces and CLI behavior in non-v2.116.0 versions.

## Caveats / to confirm (human verification checklist)

1. **Per-plan retention numbers** — Free **1 day**, Pro **7 days**, Team **28 days**, Enterprise **90 days**. Verified from the pricing comparison table on 2025-09-12; **re-confirm at citation time** as pricing pages change. Row label: "Log retention (API & Database)".
2. **`source` selectors** for PostgREST/Auth/Storage/Realtime — CONFIRMED only `edge_logs`, `postgres_logs`, `function_edge_logs`, `function_logs`. A human MUST confirm the exact strings for the remaining surfaces via the Logs Explorer source dropdown or docs before hardcoding them.
3. **CLI log retrieval** — CONFIRMED absent in v2.116.0. If the skill targets a different pinned CLI version, re-verify `supabase --help`.
4. **Log Drains tier gating** — confirm Team vs Enterprise availability and supported destinations before recommending as the long-retention path.
