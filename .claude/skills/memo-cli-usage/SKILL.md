---
name: memo-cli-usage
description: "Read and write architectural decisions to the shared memo-cli knowledge base. Use when recording or restoring cross-session context."
---

# memo-cli Usage — Quick Reference

Operate `memo-cli` for reading and writing architectural decisions in a shared Qdrant vector database. For full CLI documentation (all flags, configuration, admin operations, schema details), see [`REFERENCE.md`](./REFERENCE.md).

---

## Setup Validation

```bash
memo setup validate   # exit 0 = configured correctly
```

If validation fails, run: `memo setup init --repo <repo> --org <org> --domain <domain>`

---

## Banks and Kinds (memo-cli 1.3.0+)

A **bank** is a namespace an agent's entries live in — the shared `kb` (default, semantic knowledge base) or a private bank like `developer-memory`, one per long-lived agent. Set `--bank <id>` on any command, or export `MEMO_BANK` for the session so every command picks it up by default:

```bash
export MEMO_BANK=developer-memory   # bank id convention: <agent-name>-memory
```

Every entry has a **kind**:

| Kind       | Meaning                                                           | Default bank behavior                                    |
| ---------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| `self`     | The agent's own persona/context, never trimmed from `recall`      | `kb` rejects `self`; only valid in private banks         |
| `episodic` | Session-scoped narration (intent/outcome), expires automatically  | requires `--session <id>`; default kind in private banks |
| `semantic` | Durable, searchable decisions — what `search`/`list` return today | default kind in `kb`                                     |

Rule of thumb: episodic entries are per-session chatter that lives in your private bank and expires; semantic entries are durable knowledge that lives in `kb` (or is promoted there later) and never expires. See [`REFERENCE.md`](./REFERENCE.md) for bank/kind command reference, `memo recall`, `memo timeline`, `memo bank`, and `memo migrate`.

---

## Session Start — Restore Context

**memo-cli 1.3.0+:** one call restores the full context bundle (SELF, POLICIES, SHARED, MINE, LAST SESSION, CONFLICTS):

```bash
memo recall "<current task description>" --bank $MEMO_BANK --json
```

If `$MEMO_BANK` is unset, `recall` resolves to `kb` and omits the private-only sections (`SELF`, `MINE`, `LAST SESSION`).

**Fallback (`memo --version` < 1.3.0, or `memo recall` unavailable):** run the four-command sequence instead:

```bash
memo list --limit 20 --json
memo tags list --sort frequency --json
memo search "<current task description>" --limit 10 --json
memo search "<key contract or dependency>" --scope related --limit 5 --json
```

Synthesize findings (either path) into:

- Constraints to preserve
- Rejected alternatives to avoid
- Contracts/boundaries that must remain stable
- Sensitive files/modules to treat carefully

---

## Writing Entries

### Intent Entry (before starting a story/task) — episodic, in your bank

```bash
memo write \
  --kind episodic \
  --session ISSUE-<number> \
  --bank $MEMO_BANK \
  --rationale "Context: Starting ISSUE-<##> because <trigger>. Decision: implement via <approach>, preserving <constraints>. Impact: affects <modules/contracts>." \
  --tags "<domain>,issue-<number>,intent,<impact-tag>" \
  --entry-type decision \
  --source agent \
  --story "ISSUE-<number>" \
  --on-duplicate consolidate \
  --json
```

### Outcome Entry (after completing a story/task) — episodic, in your bank

```bash
memo write \
  --kind episodic \
  --session ISSUE-<number> \
  --bank $MEMO_BANK \
  --rationale "Context: Completed ISSUE-<##>. Delivery: shipped <behavior>, deviations <none|details>, AC <x/y> verified. Impact: quality gates test=<p/f>; lint=<p/f>; format:check=<p/f>; typecheck=<p/f>; audit=<p/f>." \
  --tags "<domain>,issue-<number>,outcome,gates-pass" \
  --entry-type decision \
  --source agent \
  --commit "$(git rev-parse HEAD)" \
  --story "ISSUE-<number>" \
  --files "<key files modified>" \
  --on-duplicate consolidate \
  --json
```

`--session` is required whenever `--kind episodic` is used; `--seq` auto-increments per session and rarely needs to be passed explicitly.

### Decision/ADR Entry (architectural choices) — semantic, in `kb`

```bash
memo write \
  --kind semantic \
  --bank kb \
  --rationale "Context: <situation>. Decision: <what was chosen>. Rationale: <why this over alternatives>." \
  --tags "<domain>,<technology>,decision" \
  --entry-type decision \
  --source agent \
  --provenance "<csv of episodic entry ids this consolidates, if any>" \
  --json
```

A `semantic` entry with `--source agent` **MUST** carry `--provenance <csv>` unless `--manual` is passed (PRD K3) — cite the episodic intent/outcome ids the decision was distilled from.

---

## Entry Types

| Type                | Use For                                       |
| ------------------- | --------------------------------------------- |
| `decision`          | Architectural/design choices, intent, outcome |
| `integration_point` | Cross-service contracts, API boundaries       |
| `structure`         | Module layout, naming conventions             |

---

## Tag Rules

- Kebab-case only: `rate-limiting` not `rateLimiting`
- 4-5 tags per entry across layers: domain, work-item, lifecycle, impact, boundary
- Check existing tags first: `memo tags list --sort frequency --json`
- Reuse over inventing new tags

---

## When to Write

- Choosing a library, framework, or architecture pattern
- Changing config files (explain why)
- Modifying core abstractions, schemas, entry points
- Establishing naming/layout conventions
- Discovering constraints (API limits, platform quirks)
- Starting/completing a story (intent/outcome)

---

## When to Search

- Before making design choices: `memo search "<topic>" --json`
- Before touching unfamiliar files: `memo search "<filename>" --json`
- Cross-repo context: `memo search "<query>" --scope related --json`

---

## Agent Mode Rules

- Always pass `--json` for parseable output
- Always pass `--on-duplicate consolidate` for writes
- Never log API keys or secrets
- Bulk delete is blocked in `--json` mode (safety guard)

---

## Session Close

No memo action in Phase 2. `memo used` and `memo decay` arrive with memo-cli 1.4.0.

---

## Quick Command Card

```
memo setup validate                                        # Verify config
memo recall "<task>" --bank $MEMO_BANK --json               # Restore full context (1.3.0+)
memo write --rationale "..." --tags "a,b,c" --json          # Record a semantic decision (kb)
memo write --kind episodic --session ID --bank $MEMO_BANK   # Record an intent/outcome entry
memo search "query" [--scope related] --json                # Semantic search
memo list [--limit N] --json                                # Browse recent
memo timeline [--session ID] --bank $MEMO_BANK --json        # Replay episodic memory in order
memo tags list [--sort frequency] --json                    # Discover tags
memo inspect --json                                          # Global facets
memo bank list --json                                        # List all banks
memo bank init --id <id> --json                              # Create a bank
memo migrate --to-v2 --dry-run --json                        # Preview legacy payload migration
memo delete --id <uuid> --json                                # Delete entry
```

> For full flag documentation, admin operations, environment setup, banks/kinds, `recall`, `timeline`, `bank`, `migrate`, and detailed examples, read [`REFERENCE.md`](./REFERENCE.md).
