# memo-cli Full Reference

> This is the complete CLI documentation for `memo-cli`. For everyday usage patterns, see `SKILL.md`.
> Agents: read this file when performing setup, configuration, admin operations, or when you need detailed flag documentation.

# memo-cli Usage Skill

Teach AI agents (and human developers) how to operate **memo-cli** — the agent-first CLI for capturing and querying architectural decisions stored in a shared Qdrant vector database.

Use this skill whenever an agent needs to **read**, **write**, **search**, or **manage** decision entries in a repository that has `memo-cli` installed.

> **Portability:** This skill is self-contained. Copy the `memo-cli-usage/` folder into any repository's `.github/skills/` directory and reference it from that repo's `AGENTS.md` or skill registry.

---

## Purpose

`memo-cli` is the **shared memory** that keeps agents coherent across time, sessions, and projects. It is not a log. It is not a changelog. It is a curated, searchable record of the decisions that shaped the codebase — written with enough precision that anyone (human or agent) arriving days, weeks, or months later can understand **what was decided, why, and what it affected**.

An agent that uses `memo-cli` well:

- Narrates its reasoning as it acts, not only at the end.
- Records the files it modifies and why those files were the right place.
- Explains configuration and architectural choices so future agents don't re-derive them.
- Tags entries consistently so discovery remains reliable across projects.

### Success Outcomes

Using memo-cli correctly SHOULD produce these outcomes:

- Faster planning and implementation by reusing prior constraints and decisions.
- Consistent execution across agents and sessions.
- Auditable traceability from decision to issue/story, files, and commit evidence.
- Better cross-repo contract safety when `--scope related` is used intentionally.

---

## Entry Purposes and Scope

Every write MUST have one clear purpose. Do not combine multiple purposes into one long entry.

| Purpose               | What it captures                                     | Entry Type          | Required lifecycle tag |
| --------------------- | ---------------------------------------------------- | ------------------- | ---------------------- |
| Intent                | Planned approach, constraints, expected impact       | `decision`          | `intent`               |
| Outcome               | Delivered behavior and validation evidence           | `decision`          | `outcome`              |
| Durable architecture  | Long-lived technical decisions and trade-offs        | `decision`          | `decision`             |
| Integration contract  | Cross-boundary assumptions and compatibility details | `integration_point` | `contract`             |
| Structural convention | Module boundaries and naming/layout rules            | `structure`         | `structure`            |

Write only reusable knowledge. Do not write routine activity noise that is already obvious from a diff.

---

## When to Write to memo-cli

Write a memo entry **during** or **immediately after** any of these moments:

| Trigger                                                                    | Entry Type               |
| -------------------------------------------------------------------------- | ------------------------ |
| Choosing a library, framework, or service                                  | `decision`               |
| Choosing how to structure a module or data model                           | `decision` / `structure` |
| Changing a config file and explaining why                                  | `decision`               |
| Identifying or formalizing a cross-service contract                        | `integration_point`      |
| Modifying critical files (entry points, core abstractions, schema)         | `decision`               |
| Discovering a constraint (API limit, platform quirk, security requirement) | `decision`               |
| Resolving a conflict between two approaches                                | `decision`               |
| Establishing a naming or layout convention                                 | `structure`              |
| Starting work on a story or task (intent entry)                            | `decision`               |
| Completing a story or task (outcome entry)                                 | `decision`               |

---

## When to Search memo-cli

Search **before** taking action, not only when stuck:

| Situation                                      | Command                                               |
| ---------------------------------------------- | ----------------------------------------------------- |
| Starting a session — restore context           | `memo list --limit 20 --json`                         |
| Normalize vocabulary before writing            | `memo tags list --sort frequency --json`              |
| Before making a design choice                  | `memo search "<topic>" --json`                        |
| Before touching a file you haven't seen before | `memo search "<filename or module name>" --json`      |
| Evaluating whether to add a dependency         | `memo search "<library name>" --scope related --json` |
| Onboarding to an unfamiliar repo               | `memo inspect --json` then `memo list --json`         |

### Required Read Sequence

At session start, run reads in this exact order:

1. `memo setup validate`
2. `memo list --limit 20 --json`
3. `memo tags list --sort frequency --json`
4. `memo search "<current issue/story/title>" --limit 10 --json`
5. `memo search "<key contract or dependency>" --scope related --limit 5 --json` (when boundary impact is expected)

Before coding or planning, synthesize findings in 4 bullets:

- Constraints to preserve
- Rejected alternatives to avoid
- Contracts/boundaries that must remain stable
- Sensitive files/modules to treat carefully

---

## Minimum Entry Schema

All entries SHOULD include these fields when applicable:

- Scope: issue/story identifier (`issue-<n>` or `story-<id>`)
- Context: what changed and why now
- Decision/Delivery: what was chosen or implemented
- Impact: downstream behavior or contracts affected
- Evidence: commit SHA and key files (`outcome` required)

Additional requirements by purpose:

- Intent entries MUST include constraints/non-goals and expected files.
- Outcome entries MUST include AC coverage and quality gate status (`test`, `lint`, `format:check`, `typecheck`, `audit`).
- Contract entries MUST include producer, consumer, validation rules, and failure behavior.

---

## Tag Taxonomy Standard

Tags MUST be kebab-case and ordered in these layers:

1. Domain tag (for example: `auth`, `tenant`, `ingestion`, `docs`)
2. Work-item tag (`issue-113`, `story-s003`)
3. Lifecycle tag (`intent`, `outcome`, `decision`, `contract`, `structure`)
4. Impact/quality tag (`security`, `migration`, `gates-pass`, `docs-drift-fixed`)
5. Optional boundary tag (`api`, `middleware`, `cross-repo`)

Use 4-5 tags whenever possible. Reuse existing tags from `memo tags list`.

---

## Prerequisites

### Environment Variables

The following variables **MUST** be set before any `memo` command will work:

| Variable              | Purpose                   | Example                 |
| --------------------- | ------------------------- | ----------------------- |
| `QDRANT_URL`          | Qdrant instance endpoint  | `http://localhost:6333` |
| `QDRANT_API_KEY`      | API key (empty for local) | `""` or a cloud key     |
| `EMBEDDINGS_PROVIDER` | Embedding backend         | `openai`                |
| `EMBEDDINGS_API_KEY`  | Provider secret key       | `sk-...`                |

> **Tip:** Store these in a `.env` file at the repository root. `memo-cli` loads it automatically via `dotenv`.

### Repository Configuration

A `memo.config.json` **MUST** exist at the repository root. Create one with:

```bash
memo setup init --repo <repo-name> --org <org-name> --domain <domain> [--relates-to repo1,repo2]
```

Verify it at any time:

```bash
memo setup validate   # exit 0 = valid
memo setup show       # print effective config
```

---

## Core Concepts

### `repo` — Repository Identity

`repo` is the **name of the codebase** this entry belongs to. It is set in `memo.config.json` and defaults into every `memo write` call automatically. Use the kebab-case name of the Git repository (e.g., `memo-cli`, `auth-service`, `api-gateway`).

**Why it matters:** Every entry is scoped to a repo. `memo search` and `memo list` filter by your current repo by default, so entries from other repos don't pollute your results unless you explicitly request them with `--scope related`.

**Rule:** Use the repo's canonical name — the one that appears in the GitHub URL. Don't abbreviate or alias it.

---

### `org` — Organization

`org` is the **owner or organization** that the repository belongs to. In GitHub terms, this is the account or org username (e.g., `llipe`, `acme-corp`, `my-team`).

**Why it matters:** `org` groups related repositories under a common owner. It enables cross-repo queries scoped to a single organization — e.g., finding all decisions made under `acme-corp` across all its services.

**Rule:** Use the GitHub organization or user handle, kebab-case. All repos under the same team should share the same `org` value.

---

### `domain` — Product or Functional Area

`domain` describes the **product area or functional concern** that this repository serves (e.g., `auth`, `payments`, `infra`, `ai`, `search`, `notifications`). It is broader than a repository — multiple repos can share the same domain.

**Why it matters:** Domain is a cross-cutting label that lets you query decisions across all repos in a functional area. For example, all `auth`-domain decisions across `auth-service`, `api-gateway`, and `user-service` can be retrieved together.

**How to choose:**

- Use the business or technical capability, not the team name.
- Keep it stable — domains change less often than repos.
- Examples: `auth`, `billing`, `data-pipeline`, `mobile`, `platform`, `ai`, `infra`, `developer-tools`.

---

### `relates_to` — Connected Repositories

`relates_to` is an **explicit list of other repository names** that this repo has a meaningful relationship with — shared contracts, shared schemas, upstream/downstream dependencies, or simply repos that an agent often works across together.

```json
{
  "relates_to": ["auth-service", "api-gateway", "shared-lib"]
}
```

**Why it matters:** Setting `relates_to` enables `--scope related` queries, which search entries across this repo **and** all listed repos simultaneously. This is how agents and developers get cross-service context without switching repositories.

**When to add a repo to `relates_to`:**

- This repo consumes an API or event contract that the other repo owns.
- Decisions in the other repo often directly constrain decisions in this one.
- You regularly need to cross-reference both repos during feature work.
- They share a data model or schema.

**Rule:** Keep `relates_to` intentional — list real dependencies, not every repo in the org. A bloated list degrades search signal.

---

### Entry Types

| Type                | When to use                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `decision`          | Architectural or design choices ("We chose Postgres over Mongo because…") |
| `integration_point` | Cross-service contracts, API boundaries, shared schemas                   |
| `structure`         | Folder layout, module boundaries, naming conventions                      |

### Source

| Value    | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| `agent`  | Written by an AI agent (default when `defaults.source` is set) |
| `manual` | Written by a human developer                                   |

### Scoping

Every entry belongs to a **repo**, **org**, and **domain** (all kebab-case). Queries default to the current repo context from `memo.config.json`.

- `--scope repo` — Only entries for the current repository.
- `--scope related` — Current repository + all repos listed in `relates_to`.

---

## Banks, Kinds, and Session Memory (memo-cli 1.3.0+)

memo-cli 1.3.0 adds a second axis of scoping — **banks** — and a third field on every entry — **kind** — on top of the repo/org/domain scoping above. Every command example in this section was verified against the local 1.3.0 build's `--help` output (`pnpm build && node dist/index.js <cmd> --help`).

### `bank` — Namespace

A bank is a namespace for entries, resolved in this priority order (B3): `--bank <id>` flag > `$MEMO_BANK` env var > `config.bank.default` > `kb`. `kb` is the shared, org-wide knowledge base every repo reads from by default; any other bank id (kebab-case or UUID) is a **private** bank — conventionally named `<agent-name>-memory` (e.g. `developer-memory`, `technical-writer-memory`, `product-engineer-memory`, `planner-memory`) for a long-lived agent's own session memory.

Export the bank once per session so every subsequent command inherits it:

```bash
export MEMO_BANK=developer-memory
```

`kb` and private banks are isolated from each other: a `search`/`list`/`recall` scoped to a private bank never returns `kb` entries and vice versa, unless you explicitly pass `--bank kb`.

### `kind` — Entry Nature

| Kind       | Meaning                                                                   | Where it lives                                              | Expires?                                             |
| ---------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `self`     | The agent's own persona/context entries (never ranked, never trimmed)     | private banks only — `kb` rejects `--kind self`             | no (subject to a soft cap warning, not a hard block) |
| `episodic` | Session-scoped narration — intent/outcome entries tied to one `--session` | private banks (default kind there)                          | yes — `policy.expires_in_days` or `--expires-in`     |
| `semantic` | Durable, searchable decisions — what `search`/`list` return by default    | `kb` (default kind there); may also exist in a private bank | no                                                   |

`--kind` is case-insensitive (`--kind Self`, `--kind SELF`, `--kind self` all normalize to `self`). Default kind is `episodic` in a private bank, `semantic` in `kb`.

**Rule of thumb for agent definitions in this repository:** intent/outcome entries are `--kind episodic --session ISSUE-<n> --bank $MEMO_BANK`; ADR/decision entries stay `--kind semantic --bank kb`.

---

## Command Reference

### `memo write` — Record a Decision

```bash
memo write \
  --rationale "Chose JWT over session cookies for stateless auth across services" \
  --tags "auth,jwt,stateless" \
  --entry-type decision \
  --source agent \
  --json
```

Episodic example — intent entry in a private bank:

```bash
memo write \
  --kind episodic \
  --session ISSUE-42 \
  --bank $MEMO_BANK \
  --rationale "Context: Starting ISSUE-42. Decision: implement via a middleware. Impact: affects the auth pipeline." \
  --tags "auth,issue-42,intent,middleware" \
  --entry-type decision \
  --source agent \
  --story "ISSUE-42" \
  --on-duplicate consolidate \
  --json
```

**Required flags:**

- `--rationale` — The decision text (1–5 000 chars).
- `--tags` — 2–5 comma-separated kebab-case tags.

**Optional flags:**

- `--entry-type` — `decision` (default) | `integration_point` | `structure` | `policy` | `observation` (default `observation` when `--kind episodic`)
- `--source` — `agent` | `manual` | `scan` (falls back to config default)
- `--commit` — Git commit SHA for traceability
- `--story` — Story or task ID
- `--files` — Comma-separated file paths touched by the decision
- `--relates-to` — Related repo names
- `--on-duplicate` — `consolidate` | `update` | `replace` | `create-new`
- `--bank <id>` — Bank id (default: `$MEMO_BANK`, `config.bank.default`, or `kb`)
- `--kind <kind>` — `self` | `episodic` | `semantic` (default: `episodic` in private banks, `semantic` in `kb`)
- `--session <id>` — Session id; **required** when `--kind episodic`
- `--seq <n>` — Explicit episodic sequence number (default: auto-incremented per session)
- `--context <ctx>` — Context tag; repeatable
- `--provenance <csv>` — Comma-separated UUIDs of source episodic entries; **required** for a `semantic` entry with `--source agent` unless `--manual` is passed (PRD K3)
- `--manual` — Force `source = manual`
- `--supersedes <id>` — Id of an existing entry this write supersedes (must share the same `bank` and `kind` as the target)
- `--pin` — Pin the entry (never auto-archived by decay)
- `--expires-in <duration>` — Episodic expiry override, e.g. `2d`, `12h`, `30m` (overrides the bank's default retention policy)
- `--json` — Machine-readable output (**always use in agent mode**)

**Duplicate handling:**
When memo detects a duplicate (same `repo + commit + story + entry_type + source`, or the equivalent v2 key including `bank`/`kind`/`session`/`seq`), interactive mode prompts for resolution. In `--json` mode you **MUST** supply `--on-duplicate` or the command will fail.

**Note:** `--confidence` is not a valid flag — confidence is inferred from `--source`.

---

### `memo search` — Semantic Search

```bash
memo search "rate limiting strategy" --limit 5 --json
```

Natural-language vector search over decision entries.

**Optional flags:**

- `--scope` — `repo` (default) | `related`
- `--tags` — Comma-separated filter (AND logic)
- `--entry-type` — Comma-separated types to include
- `--source` — Comma-separated sources to include
- `--limit` — Max results (default 10)
- `--lexical <on|off>` — Enable/disable lexical identifier matching (default `on`)
- `--explain` — Show a per-result factor breakdown
- `--bank <id>` — Bank id (default: `$MEMO_BANK`, `config.bank.default`, or `kb`)
- `--kind <kind>` — `self` | `episodic` | `semantic` | `all` (default `all`, case-insensitive)
- `--session <id>` — Restrict to an episodic session id
- `--include-archived` — Include archived entries
- `--include-superseded` — Include superseded entries
- `--as-of <iso>` — Point-in-time read (ISO 8601 date or datetime); implies `--include-superseded`
- `--json` — Machine-readable output

`--bank`, `--kind`, and `--session` isolate results the same way across `search`, `list`, `tags list`, and `read` — a query scoped to a private bank never returns `kb` results and vice versa, unless `--bank kb` is passed explicitly.

---

### `memo list` — Chronological Browse

```bash
memo list --limit 20 --json
```

Most-recent-first listing with optional date range.

**Optional flags:**

- `--scope`, `--tags`, `--entry-type`, `--source` — Same as search
- `--from` / `--to` — ISO 8601 date boundaries
- `--limit` — Max results (default 20)
- `--bank`, `--kind`, `--session`, `--include-archived`, `--include-superseded`, `--as-of` — Same read-side flags as `search`
- `--json` — Machine-readable output

---

### `memo timeline` — Replay Episodic Memory

```bash
memo timeline --bank $MEMO_BANK --session ISSUE-42 --json
```

Replays episodic memory **in sequence order** — never ranked. Two shapes:

- With `--session <id>`: entries for that session, ordered by `seq` ascending (ties broken by `timestamp_utc` ascending).
- Without `--session`: recent episodic entries across the bank, newest-first, grouped by `session_id`; JSON shape is `{ sessions: [{ session_id, entries }] }`.

**Optional flags:**

- `--bank <id>` — Bank id (default: `$MEMO_BANK`, `config.bank.default`, or `kb`)
- `--session <id>` — Restrict to one episodic session
- `--last <n>` — Maximum number of entries (default 50, max 500 — values above 500 are clamped with a stderr warning)
- `--since <iso>` — Inclusive ISO 8601 lower bound for `timestamp_utc`
- `--json` — Machine-readable output

An empty bank returns exit `0` with `count: 0`. `timeline` never calls embeddings and never ranks — this is a raw sequence replay, unlike `search`.

---

### `memo bank` — Manage Memory Banks

```bash
memo bank list --json
memo bank show --id developer-memory --json
memo bank init --id developer-memory --set-default --json
```

Subcommands:

- **`bank init`** — Create a bank by writing its first `self` entry.
  - `--id <id>` — Bank id (kebab-case or UUID; `kb` is rejected)
  - `--rationale <text>` — Rationale for the self entry (default: `"Bank <id> initialised."`)
  - `--tags <csv>` — 2–5 comma-separated tags (default: `bank,self`)
  - `--set-default` — Set this bank as `config.bank.default` (writes `memo.config.json` unconditionally, every time the flag is passed)
  - `--json` — Machine-readable output
  - Idempotent: if the bank already has entries, `init` prints the existing summary and writes nothing.
- **`bank list`** — List every bank with counts per kind (`self`/`episodic`/`semantic`). `--json` for machine-readable output.
- **`bank show`** — Show one bank's `self` entries plus counts per kind **and per state** (`active`, `archived`, `superseded`), and `last_session_id`.
  - `--id <id>` — Bank id (required)
  - `--json` — Machine-readable output

`bank list`/`bank show` never accept `--orgs`/`--repos`/`--domains` — banks are an orthogonal axis to those facets, and private-bank entries may have no `repo`/`org` at all.

---

### `memo migrate --to-v2` — Migrate Legacy Payloads

```bash
memo migrate --to-v2 --dry-run --json
memo migrate --to-v2 --json
```

Migrates legacy v1 stored payloads to schema v2, idempotently (a point that already has `schema_version: '2'` is skipped on every run — the second real run always scans `0`). Nothing is archived, nothing is deleted, no vector is touched — this only rewrites payload fields (`bank = kb`, `schema_version = '2'`, `kind` per the matching rule, retention/counter defaults).

**Flags:**

- `--to-v2` — Target schema version; currently the only supported target (**required**)
- `--dry-run` — Plan only; writes nothing; exits `0`; prints counts
- `--rules <file>` — JSON file replacing the default rule set (see below)
- `--json` — Machine-readable output; without it, progress prints to stderr

**Migration guidance — always dry-run first:**

1. Run `memo migrate --to-v2 --dry-run --json` and review the `byRule` counts and `skipped` total before doing anything else.
2. Only run the real migration (`memo migrate --to-v2 --json`, no `--dry-run`) against your own local/dev Qdrant instance — **never** against a shared or production collection without a separate, explicit human-confirmed step. This is a `developer`-workstation operation, not something to run unattended in CI or against `infra-engineer`-owned infrastructure.
3. Re-run `--dry-run` afterward to confirm `scanned: 0` — that's the idempotency check.

**Custom `--rules` file** (optional, replaces the default FR-2.8 rule set):

```json
[
  {
    "name": "1",
    "when": { "tags_any": ["intent", "outcome"] },
    "set": { "kind": "episodic", "session_from": "story", "expires_in_days": 90 }
  },
  { "name": "2", "when": {}, "set": { "kind": "semantic" } }
]
```

`when` supports `tags_any`, `tags_all`, `entry_type_in`, `source_in`, `repo_in`; `set.kind` is required (any of `self`/`episodic`/`semantic`); `session_from` (`story | legacy`) and `expires_in_days` apply only to `episodic` rules. Rules are evaluated in order, first match wins. A rules file that leaves any point unmatched fails validation up front (`VALIDATION_FAILED`, "rule set is not exhaustive: add a final rule with empty `when`") — always end your custom rule set with a catch-all `{ "when": {} }` entry.

---

### `memo recall` — One-Call Context Restore

```bash
memo recall "<task description>" --bank $MEMO_BANK --json
```

The 1.3.0 replacement for the four-command session-start sequence (`list` + `tags list` + `search` + `search --scope related`). Gathers, in one call (≤ 4 s target):

| Section        | Content                                                               | Omitted when                                        |
| -------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| `SELF`         | This agent's own persona/context entries, newest first, never trimmed | `--bank` resolves to `kb`                           |
| `POLICIES`     | Ranked semantic policy entries from `kb`                              | never (empty until later phases add policy entries) |
| `SHARED`       | Ranked semantic entries from `kb`, scoped by `--scope`                | never                                               |
| `MINE`         | Ranked semantic entries from this agent's own bank                    | `--bank` resolves to `kb`                           |
| `LAST SESSION` | The most recent episodic session's entries, in `seq` order            | `--bank` resolves to `kb`                           |
| `CONFLICTS`    | Pending-contradiction entries (empty until a later phase)             | never                                               |

**Flags:**

- `--bank <id>` — Bank id (default: `$MEMO_BANK`, `config.bank.default`, or `kb`)
- `--scope <scope>` — `repo` | `related`, applies to `SHARED` only (default: config or `repo`)
- `--max-tokens <n>` — Token budget (default: `config.recall.max_tokens`, `2000`)
- `--json` — Machine-readable output

When the budget is tight, sections are trimmed in this order: `conflicts` → `last_session` (oldest entries first) → `mine` → `shared` → `policies`. `SELF` is **never** trimmed, even if it alone exceeds the budget — in that case `truncated` lists every other section and the response honestly reports `budget.used_tokens > max_tokens` rather than silently cutting `SELF`. `recall` performs zero writes.

**On failure:** `memo recall` exits `2` on an embeddings failure (`EMBEDDING_API_ERROR`) or a mid-gather Qdrant failure (`QDRANT_OPERATION_FAILED`) — there is no partial-bundle fallback. Treat this the same as any other exit-`2` failure: surface the warning, and continue the session without recalled context rather than blocking on it.

**When `$MEMO_BANK` is unset** (resolves to `kb`): `SELF`, `MINE`, and `LAST SESSION` are omitted from the response entirely (omitted keys, not empty arrays) — you still get `POLICIES`, `SHARED`, `CONFLICTS`.

**Fallback when `memo recall` is unavailable** (`memo --version` below `1.3.0`, or the command errors as unrecognized): fall back to the four-command sequence documented under **Session Start — Restore Context** in `SKILL.md`.

---

### `memo tags list` — Discover Tags

```bash
memo tags list --sort frequency --json
```

Shows all unique tags with entry counts.

**Optional flags:**

- `--scope` — `repo` | `related`
- `--sort` — `alpha` (default) | `frequency`
- `--json` — Machine-readable output

---

### `memo inspect` — Global Facet Discovery

```bash
memo inspect --json
```

Lists all organizations, repositories, and domains across the entire knowledge base (ignores repo scope). Useful for onboarding and cross-team exploration.

**Optional flags:**

- `--orgs` / `--repos` / `--domains` — Show only one facet
- `--json` — Machine-readable output

---

### `memo delete` — Remove Entries

**Single entry:**

```bash
memo delete --id <uuid> --json
```

**Bulk (interactive only — blocked in `--json` mode for safety):**

```bash
memo delete --all-by-repo <repo-name> --yes
memo delete --all-by-org <org-name> --yes
```

Exactly one of `--id`, `--all-by-repo`, or `--all-by-org` is required.

---

## Agent Workflows

### Starting a Session — Restore Context

**memo-cli 1.3.0+ (preferred):** confirm config, then restore the full context bundle in one call:

```bash
# 1. Confirm config is valid
memo setup validate

# 2. Restore SELF, POLICIES, SHARED, MINE, LAST SESSION, CONFLICTS in one bundle
memo recall "<current task or feature description>" --bank $MEMO_BANK --json
```

**Fallback (`memo --version` below `1.3.0`):** run this sequence instead, before writing a single line of code:

```bash
# 1. Confirm config is valid
memo setup validate

# 2. Discover what repos/orgs/domains exist
memo inspect --json

# 3. Review recent decisions for this repo
memo list --limit 20 --json

# 4. Check the established tag vocabulary
memo tags list --sort frequency --json

# 5. Search for context relevant to the current task
memo search "<current task or feature description>" --limit 10 --json
```

Read the results before proceeding, whichever path was used. Prior entries may contain constraints, preferred patterns, or rejected alternatives that directly affect how you should approach the current task. If `memo recall` exits `2` (embeddings failure), surface the warning and continue the session without recalled context.

### Ending a Session — No Memo Action in Phase 2

Phase 2 has no session-close memo step. `memo used` (marking which recalled entries were actually useful) and `memo decay` (retention scoring) arrive with memo-cli 1.4.0 — do not invent a workaround for either in the meantime.

---

### Recording Decisions — As You Work, Not Only at the End

Write a memo entry **at the moment you make a decision**, not as a post-hoc summary. This preserves the full reasoning before context is lost.

**Template:**

```bash
memo write \
  --rationale "CONTEXT. DECISION. RATIONALE." \
  --tags "tag1,tag2,tag3" \
  --entry-type decision \
  --source agent \
  --commit "$(git rev-parse HEAD)" \
  --story "ISSUE-42" \
  --files "path/to/file1.ts,path/to/file2.ts" \
  --json
```

The `--rationale` field is the most important field. See **Writing Quality** below.

---

### Recording File Changes — Explain the Why

When modifying a significant file (entry point, core abstraction, schema, config), record what changed and why:

```bash
memo write \
  --rationale "Modified src/lib/config.ts to add schema_version validation. The config loader previously accepted any object; adding Zod validation ensures CLI commands fail fast on malformed configs rather than producing silent errors downstream." \
  --tags "config,validation,config-ts,error-handling" \
  --entry-type decision \
  --source agent \
  --commit "$(git rev-parse HEAD)" \
  --files "src/lib/config.ts,src/types/config.ts" \
  --json
```

---

### Recording Configuration Decisions

Configuration decisions are especially important to preserve — they often appear opaque later with no obvious rationale in the code.

```bash
memo write \
  --rationale "Set QDRANT_COLLECTION_NAME to 'decisions' permanently rather than making it configurable. A single collection per deployment simplifies queries and access control. Multi-tenancy is achieved via repo/org payload fields, not separate collections. Reconsidering this would require a data migration." \
  --tags "qdrant,config,multi-tenancy,collection-design" \
  --entry-type decision \
  --source agent \
  --json
```

Configuration decisions to always record:

- Environment variable semantics (what the value controls, valid ranges, defaults)
- Feature flags and their trigger conditions
- Schema versions and migration policies
- Storage layout choices (collection names, index strategies, partitioning)
- Security-related configuration (TLS, auth, CORS, rate limits)

---

### Intent Entry — Narrate Before Acting

For significant tasks, write an **intent entry** before starting implementation. This creates a checkpoint that future sessions can find, and anchors the rationale for every decision that follows.

```bash
memo write \
  --rationale "Starting implementation of story ISSUE-37: safe delete command. Approach: add a --yes flag for non-interactive confirmation, block --json with bulk delete flags (safety guard for agents), preview affected entries before deletion. No soft-delete; permanent removal via Qdrant point deletion. This matches the existing write/search command pattern." \
  --tags "delete,safety,issue-37,intent" \
  --entry-type decision \
  --source agent \
  --story "ISSUE-37" \
  --json
```

---

### Outcome Entry — Summarize After Completing

When finishing a task, write an **outcome entry** that captures what actually happened vs. what was intended:

```bash
memo write \
  --rationale "Completed ISSUE-37 safe delete command. Shipped: --id single delete, --all-by-repo and --all-by-org bulk delete (interactive only), --yes to skip confirm, preview before deletion. Deviation from intent: bulk delete also disallowed with --json (not just flagged) after discovering Qdrant batch delete has no confirmation step. Modified: src/commands/delete.ts (new), tests/unit/commands/delete.test.ts (new)." \
  --tags "delete,safety,issue-37,outcome" \
  --entry-type decision \
  --source agent \
  --story "ISSUE-37" \
  --files "src/commands/delete.ts,tests/unit/commands/delete.test.ts" \
  --json
```

---

## Writing Quality

The `--rationale` field must be **precise enough that a different developer or agent — with no prior context — can understand what was decided, why, and what it affects.** A good entry answers three questions:

1. **Context** — What is the situation, constraint, or problem?
2. **Decision** — What was chosen or done?
3. **Rationale** — Why this choice over the alternatives?

### Good vs. Bad Examples

**Too vague — useless to a future reader:**

> "Updated auth to use JWT."

**Precise — useful across sessions and developers:**

> "Switched authentication from server-side sessions to JWT (HS256, 15-min access + 7-day refresh). Sessions required sticky routing which is incompatible with the planned horizontal scaling. JWTs are stateless — any instance can validate without a shared session store. Trade-off: revocation requires a Redis blacklist (added to ISSUE-51 backlog). Files: src/auth/jwt.ts, src/middleware/auth.ts."

---

**Too vague:**

> "Changed config validation."

**Precise:**

> "Added Zod validation to memo.config.json loader (src/lib/config.ts). Previously the code trusted the file's shape; malformed configs caused cryptic runtime errors deep in Qdrant queries. Now the CLI fails immediately at startup with a structured error message. This is the single place config is read — no other validation needed."

---

**Too vague:**

> "Used Redis for caching."

**Precise:**

> "Chose Redis (via ioredis) over in-process LRU cache for rate-limit counters. In-process cache doesn't survive pod restarts and is not shared across replicas. Redis TTL natively aligns with the sliding window algorithm. Accepted dependency: Redis must be available in all environments. Config: REDIS_URL env var, no auth in dev, TLS required in prod."

---

### Structural Rule

Write `--rationale` as a single coherent paragraph (or 2-3 short sentences). **Avoid bullet points** in the rationale field — they fragment reasoning and lose connective logic. Save structure for tags.

Minimum viable rationale: **context sentence + decision sentence + why sentence**.

---

## Tag Strategy

Tags are the primary way to discover entries. Good tagging makes the difference between a searchable knowledge base and an unsearchable archive.

### Tag Layers

Apply tags across **multiple layers** simultaneously:

| Layer              | Purpose                 | Examples                                               |
| ------------------ | ----------------------- | ------------------------------------------------------ |
| **Domain/feature** | What area of the system | `auth`, `rate-limiting`, `config`, `delete`, `storage` |
| **Technology**     | What tech is involved   | `qdrant`, `redis`, `openai`, `zod`, `jwt`              |
| **Entry nature**   | What kind of change     | `intent`, `outcome`, `constraint`, `trade-off`, `adr`  |
| **Story/task ref** | Traceability            | `issue-37`, `story-s003`, `prd-001`                    |
| **Scope**          | How broad the impact    | `cross-repo`, `breaking-change`, `config-change`       |

Every write SHOULD include tags from at least **2–3 layers**.

### Before Inventing a Tag — Check What Exists

```bash
memo tags list --sort frequency --json
```

Re-use existing tags whenever possible. Consistent vocabulary is what allows `memo search` to surface related entries from weeks ago or from a different repository.

### Tag Naming Rules

- Kebab-case only: `rate-limiting`, not `rateLimiting` or `rate_limiting`.
- Prefer specific over generic: `qdrant-collection` over `database`.
- For story/task refs: `issue-37`, `story-s003` (numeric, no spaces).
- Session markers: `intent` (beginning of task) and `outcome` (completion).
- For cross-cutting concerns: `breaking-change`, `security`, `performance`, `config-change`.

### Tag Examples by Scenario

**Architectural decision on storage:**

```
qdrant,collection-design,multi-tenancy,decision,adr
```

**Config change:**

```
config,env-vars,config-change,issue-42
```

**Integration contract between two services:**

```
api-contract,auth-service,cross-repo,integration-point,breaking-change
```

**Starting a new feature (intent):**

```
delete-command,safety,issue-37,intent
```

**Completing a feature (outcome):**

```
delete-command,safety,issue-37,outcome
```

**Performance trade-off:**

```
embeddings,openai,performance,trade-off,caching
```

---

## Multi-Developer & Cross-Session Context

`memo-cli` is designed so that **every agent and every developer shares the same decision history**. This is what enables continuity across days, team rotations, and parallel workstreams.

### Shared Knowledge Base

All entries are stored in a shared Qdrant instance. When Developer A (or Agent A) records a decision, Developer B can immediately find it via `memo search`. There is no per-user silo.

### Cross-Repository Visibility

Use `--scope related` to query across connected repositories:

```bash
memo search "auth contract" --scope related --json
```

This is critical for:

- Microservice architectures where contracts span repos.
- Agent workflows that touch multiple repositories in sequence.
- Detecting when a decision in one repo contradicts a constraint in another.

Configure related repos in `memo.config.json`:

```json
{
  "relates_to": ["auth-service", "api-gateway", "shared-lib"]
}
```

### Session Continuity for Agents

Agents are stateless between sessions. To maintain continuity:

1. **Start every session** with `memo list` and `memo search` — always.
2. **Write an intent entry** before starting significant work.
3. **Write as you decide**, not as a batch at the end.
4. **Write an outcome entry** when completing a task, including any deviations from intent.
5. **Tag consistently** — check `memo tags list` before picking tags.

### Multi-Day Work Pattern

For work that spans multiple days:

- **Day 1 end**: Write an outcome entry with current state, what's done, what's next, any open questions.
- **Day 2 start**: `memo search "<task name or issue number>" --json` to restore exact context.
- The tags `intent` and `outcome` combined with a story tag (e.g., `issue-37`) make the full arc of a feature retrievable as a timeline.

### What to Record vs. What to Skip

| Record                                        | Skip                                                        |
| --------------------------------------------- | ----------------------------------------------------------- |
| Architectural choices and their rationale     | Trivial implementation details (variable names, formatting) |
| Technology selections with trade-off analysis | Routine bug fixes with no design impact                     |
| Configuration changes that affect behavior    | Code style choices (use linters)                            |
| API contracts and integration boundaries      | Dependency version bumps (use lockfile)                     |
| Security-sensitive design choices             | Temporary workarounds expected to be removed within hours   |
| Performance trade-offs and their context      | Generated code                                              |
| Rejected alternatives and why                 | CI/build configuration (use config files)                   |
| Constraints discovered during implementation  | Debugging steps                                             |

---

## Memory Scopes (IDE / Agent Memory vs. memo-cli)

Many agent runtimes (e.g., VS Code Copilot) have a built-in memory system alongside `memo-cli`. Understanding when to use each prevents both redundancy and gaps.

| Scope                 | Where                  | Persistence                                    | Use For                                                                                     |
| --------------------- | ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **User memory**       | `/memories/`           | All workspaces, all sessions                   | Personal preferences, debugging patterns, general agent insights                            |
| **Session memory**    | `/memories/session/`   | Current conversation only                      | Scratch notes, in-progress state, temporary checklists                                      |
| **Repository memory** | `/memories/repo/`      | Current workspace                              | Repo gotchas, build commands, local conventions — fast-access notes for this repo           |
| **memo-cli**          | Qdrant (shared remote) | Permanent, shared across all people and agents | Architectural decisions, integration contracts, structural choices, configuration rationale |

### Decision Tree: Where Does This Information Belong?

```
Is it a decision, rationale, constraint, contract, or config choice?
  └─ YES → memo write  (it belongs to the shared knowledge base)

Is it a repo-specific gotcha or quick operational fact?
  └─ YES → /memories/repo/ (and also memo write if it reflects a real design choice)

Is it a personal preference or general agent pattern?
  └─ YES → /memories/ (user memory)

Is it temporary context that only matters for the current session?
  └─ YES → /memories/session/
```

**Key principle:** If the information would help a _different_ developer or agent working in the same codebase — even a year from now — it belongs in `memo-cli`.

---

## Safe Operation Guardrails

### Non-Destructive Defaults

- `memo delete` requires confirmation by default. Use `--yes` to skip only when you are certain.
- Bulk delete (`--all-by-repo`, `--all-by-org`) is **blocked in `--json` mode** as a safety guard against accidental mass deletion by agents.
- `memo write` detects duplicates and prompts for resolution rather than silently overwriting.

### Agent Mode (`--json`)

Agents **SHOULD** always pass `--json` for predictable, parseable output. Key behaviors in JSON mode:

- All output is structured JSON on stdout.
- Errors produce JSON error objects to stderr.
- Interactive prompts are suppressed — flags must supply all decisions.
- `--on-duplicate` is required when a duplicate is detected.
- Bulk delete is prohibited.

### Validation Before Writing

Before `memo write`, agents SHOULD:

1. Verify `memo setup validate` passes.
2. Confirm tags are kebab-case (lowercase, hyphens only).
3. Ensure rationale is meaningful (not placeholder text).
4. Check for duplicates with `memo search` first.

### Error Handling

All `memo` commands exit with:

- **0** — Success
- **1** — Validation or user error (bad flags, invalid config)
- **2** — Unexpected/infrastructure error (Qdrant down, embedding API failure)

When a command fails:

1. Read the error code and message from stderr.
2. For exit code 1: fix the input and retry.
3. For exit code 2: check connectivity (`QDRANT_URL`) and API keys before retrying.

### Environment Variable Safety

- **Never** log or output `EMBEDDINGS_API_KEY` or `QDRANT_API_KEY`.
- Store credentials in `.env` (which should be in `.gitignore`).
- For CI/CD, use secrets management rather than plaintext config.

---

## Quick Reference Card

```
memo setup init --repo <r> --org <o> --domain <d>              # Initialize config
memo setup validate                                              # Verify config
memo setup show [--json]                                         # Display config

memo recall "<task>" --bank $MEMO_BANK [--json]                  # Restore full context (1.3.0+)
memo write --rationale "..." --tags "a,b,c" [--json]             # Record a semantic decision (kb)
memo write --kind episodic --session ID --bank $MEMO_BANK [--json]  # Record an intent/outcome entry
memo search "query" [--scope related] [--bank ID] [--kind K] [--json]  # Semantic search
memo list [--from DATE] [--to DATE] [--bank ID] [--kind K] [--json]     # Browse entries
memo timeline [--session ID] --bank $MEMO_BANK [--last N] [--json]      # Replay episodic memory in order
memo tags list [--sort frequency] [--json]                       # Discover tags
memo inspect [--json]                                             # Global facets
memo bank list [--json]                                           # List all banks
memo bank show --id <id> [--json]                                 # Show one bank's self entries + counts
memo bank init --id <id> [--set-default] [--json]                 # Create a bank
memo migrate --to-v2 --dry-run [--json]                           # Preview legacy payload migration
memo migrate --to-v2 [--json]                                     # Apply legacy payload migration (local/dev only)
memo delete --id <uuid> [--json]                                  # Delete entry
```

---

## Installation in Another Repository

1. **Copy** the `memo-cli-usage/` folder into `<your-repo>/.github/skills/`.
2. **Add** the skill to your agent/skill registry (e.g., `AGENTS.md`):
   ```markdown
   | memo-cli-usage | `.github/skills/memo-cli-usage/` | Agent guidance for memo-cli operations | Any agent |
   ```
3. **Install** `memo-cli` as a dev dependency:
   ```bash
   pnpm add -D memo-cli   # or npm install -D memo-cli
   ```
4. **Configure** the repository:
   ```bash
   npx memo setup init --repo <name> --org <org> --domain <domain>
   ```
5. **Set** environment variables (`.env` or CI secrets):
   ```
   QDRANT_URL=http://localhost:6333
   QDRANT_API_KEY=
   EMBEDDINGS_PROVIDER=openai
   EMBEDDINGS_API_KEY=sk-...
   ```
6. The skill is now active — any agent that loads it will know how to use `memo-cli`.
