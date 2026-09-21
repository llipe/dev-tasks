# Scenario (b): cap-reached sequence — continue/stop, no auto-decision

**Verifies:** S-001-AC-4, S-001-AC-5 (FR-6, FR-9).

## Setup

- Feature: `widget-cache` (invented, trivial feature for this fixture).
- `docs/tech.md` has no "Grilling" subsection — the hardcoded default cap
  applies: 25 per phase, Feature Mode.
- `activity-grill(phase="WHAT", cap=25)` has resolved 24 questions
  (mix of asked and self-resolved), each appended as `D-01`..`D-24`.
- The open-questions list still has 6 entries remaining.

## Transcript

```
[activity-grill -> user]
Question 25 of this phase (branch: widget-cache/eviction-policy):
"What eviction policy should the cache use?"
Recommended: LRU (matches the existing lru-cache backend chosen at D-01).

[user]
LRU works.

[activity-grill -> workstream/decisions-widget-cache.md, appended immediately]
| D-25 | WHAT | widget-cache/eviction-policy | What eviction policy should
the cache use? | LRU (matches the existing lru-cache backend chosen at
D-01). | LRU works. | yes | — | @user | <date> |

[activity-grill, cap check]
25 questions resolved this phase. Cap (25) reached.

[activity-grill -> user, decision-tree summary — required at cap, FR-6]
Resolved branches: widget-cache/storage-backend (D-01), ... ,
widget-cache/eviction-policy (D-25).
Current branch: widget-cache/eviction-policy (just closed).
Remaining open: widget-cache/ttl-config, widget-cache/invalidation-hook,
widget-cache/metrics-export, widget-cache/warm-start,
widget-cache/multi-tenant-isolation, widget-cache/error-fallback.

[activity-grill -> user]
The question cap (25) has been reached for this phase, with 6 questions
still open. Continue (raise the cap) or stop (draft with what's settled,
leaving the remaining 6 as recorded Open Questions)?

[user]
<awaiting reply — the skill does not proceed until the user answers>
```

## Expected outcome

- The skill stops exactly at the cap and does not ask a 26th question
  before the user responds to the continue-or-stop prompt.
- The decision-tree summary (resolved branches with IDs, current branch,
  remaining open list) is shown at the cap, per FR-6.
- The skill never auto-continues (silently asking question 26) and never
  auto-stops (silently drafting with the 6 unresolved branches folded into
  "Open Questions" without asking first) — both directions require an
  explicit user reply.
