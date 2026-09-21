# Scenario (a): codebase-answerable question resolved silently

**Verifies:** AC-1 (FR-3, AC-04), S-001-AC-1, S-001-AC-3.

## Setup

- Feature: `widget-cache` (invented, trivial feature for this fixture).
- `activity-refine` has invoked `activity-grill(phase="WHAT", cap=25)`.
- The depth-first branch currently open is `widget-cache/storage-backend`.
- The repository's `docs/tech.md` already contains a "Caching" subsection
  stating: "All server-side caches use the existing `lru-cache` package;
  no new cache dependency is introduced without an ADR."

## Transcript

```
[activity-grill, internal reasoning — not shown to user]
Branch: widget-cache/storage-backend
Question under consideration: "What cache storage backend should widget-cache use?"

Step 3 resolve-before-ask:
  (a) codebase read: no widget-cache code exists yet — no direct answer.
  (b) docs/tech.md read: "Caching" subsection found, states lru-cache is
      the standing choice; no new dependency without an ADR.
  -> resolved at step (b). Do not ask the user.

[activity-grill -> workstream/decisions-widget-cache.md, appended immediately]
| D-01 | WHAT | widget-cache/storage-backend | What cache storage backend
should widget-cache use? | n/a | docs/tech.md § Caching states lru-cache is
the standing choice for server-side caches; no new dependency without an
ADR. | n/a | — | activity-grill | <date> |

[activity-grill -> user]
(no message — nothing surfaced; the loop proceeds directly to the next
unresolved branch, if any, or to the exit-gate check if none remain)
```

## Expected outcome

- No question is ever shown to the user for this branch.
- Exactly one row is appended to `workstream/decisions-widget-cache.md`,
  with `Accepted rec.` = `n/a` and `Answer` stating what was found (the
  `docs/tech.md` subsection) and where.
- The depth-first loop advances to the next branch (or the exit gate) in
  the same turn — the skill does not pause to announce the silent
  resolution as if it were a question.
