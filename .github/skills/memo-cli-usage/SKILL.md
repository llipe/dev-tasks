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

## Session Start — Restore Context

Run before writing any code:

```bash
memo list --limit 20 --json
memo tags list --sort frequency --json
memo search "<current task description>" --limit 10 --json
memo search "<key contract or dependency>" --scope related --limit 5 --json
```

Synthesize findings into:

- Constraints to preserve
- Rejected alternatives to avoid
- Contracts/boundaries that must remain stable
- Sensitive files/modules to treat carefully

---

## Writing Entries

### Intent Entry (before starting a story/task)

```bash
memo write \
  --rationale "Context: Starting ISSUE-<##> because <trigger>. Decision: implement via <approach>, preserving <constraints>. Impact: affects <modules/contracts>." \
  --tags "<domain>,issue-<number>,intent,<impact-tag>" \
  --entry-type decision \
  --source agent \
  --story "ISSUE-<number>" \
  --on-duplicate consolidate \
  --json
```

### Outcome Entry (after completing a story/task)

```bash
memo write \
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

### Decision Entry (architectural choices)

```bash
memo write \
  --rationale "Context: <situation>. Decision: <what was chosen>. Rationale: <why this over alternatives>." \
  --tags "<domain>,<technology>,decision" \
  --entry-type decision \
  --source agent \
  --json
```

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

## Quick Command Card

```
memo setup validate                                   # Verify config
memo write --rationale "..." --tags "a,b,c" --json    # Record decision
memo search "query" [--scope related] --json          # Semantic search
memo list [--limit N] --json                          # Browse recent
memo tags list [--sort frequency] --json              # Discover tags
memo inspect --json                                   # Global facets
memo delete --id <uuid> --json                        # Delete entry
```

> For full flag documentation, admin operations, environment setup, and detailed examples, read [`REFERENCE.md`](./REFERENCE.md).
