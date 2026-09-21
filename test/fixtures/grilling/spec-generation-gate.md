# Scenario (f): `activity-generate-spec` blocks drafting until the HOW-phase exit gate is satisfied

**Verifies:** S-003-AC-1, S-003-AC-2, S-003-AC-3 (FR-13, FR-14, AC-02).

## Setup

- Feature: `widget-cache` (same invented, trivial feature as scenarios (c)
  and (e), reused here for continuity). `workstream/decisions-widget-cache.md`
  already holds `D-01` and `D-02` from scenario (e)'s WHAT phase.
- A PRD for `widget-cache` is approved. `product-engineer`'s conditional
  pre-step `researcher` call (ADR-004) evaluated its trigger heuristics
  for this trivial, single-file feature and did **not** fire — no
  `/workstream/research-*.md` artifact exists.
- User hands `activity-generate-spec` the approved PRD and confirms
  `docs/tech.md` is available.
- `activity-generate-spec` reaches Process step 3 and invokes
  `activity-grill(phase="HOW", cap=cap.how)` before asking any technical
  design question or producing any specification content.

## Transcript

```
[activity-generate-spec, step 1]
No pre-step researcher artifact found (heuristics did not trigger) —
proceeding without one, per the Edge-Case Matrix note that a missing
pre-step artifact never blocks the HOW phase.

[activity-generate-spec, step 3]
Invoking activity-grill(phase="HOW", cap=25) before any drafting. The
WHAT-phase decision log (D-01, D-02) is already present; the HOW phase's
IDs continue the same single ID space, starting at D-03.

[activity-grill, branch: widget-cache/eviction-policy]
Question: "What eviction policy does the in-process cache use?"
Recommended: LRU with a fixed entry cap — simplest policy that bounds
memory for a trivial, single-endpoint cache.

[user]
LRU, agreed.

[activity-grill -> workstream/decisions-widget-cache.md, appended]
| D-03 | HOW | widget-cache/eviction-policy | What eviction policy does
the in-process cache use? | LRU with a fixed entry cap | LRU, agreed. |
yes | — | activity-grill | <date> |

[activity-grill, branch: widget-cache/metrics]
Question: "Does the cache emit hit/miss metrics?"
Recommended: yes — a write-through cache without hit/miss visibility is
unverifiable in production.

[user]
Yes, agreed.

[activity-grill -> workstream/decisions-widget-cache.md, appended]
| D-04 | HOW | widget-cache/metrics | Does the cache emit hit/miss
metrics? | yes | Yes, agreed. | yes | — | activity-grill | <date> |

[activity-grill, exit-gate attempt]
Open list: empty.

[activity-grill -> user]
The open list is empty. Do you confirm shared understanding so I can
draft?

[user]
I confirm, proceed.

[activity-grill -> activity-generate-spec]
exit gate satisfied

[activity-generate-spec, step 4 — only now, after the exit gate]
Generating specification. Business Logic Implementation section states:
"The in-process cache MUST evict using LRU with a fixed entry cap
(D-03)." Performance & Scalability Approach section states: "The cache
MUST emit hit/miss metrics (D-04)."

[activity-generate-spec, specification `## Decisions (HOW phase)` section]
| ID   | Decision (short form)                         |
| ---- | ------------------------------------------------ |
| D-03 | In-process cache evicts using LRU, fixed cap.     |
| D-04 | Cache emits hit/miss metrics.                     |
```

## Expected outcome

- The conditional pre-step `researcher` call is evaluated and sequenced
  **before** `activity-generate-spec`'s HOW-phase `activity-grill`
  invocation (step 1 runs before step 3), whether or not it actually
  fires — confirming AC-2's sequencing requirement independent of the
  trigger heuristics' outcome.
- No specification section, draft, or outline is produced before the
  exit-gate confirmation — step 4 (Generate Specification) does not run
  until `activity-grill` returns satisfied.
- The HOW phase's IDs (`D-03`, `D-04`) continue the same file's single ID
  space already holding the WHAT phase's `D-01`, `D-02` — no phase-local
  restart.
- Once drafted, the specification cites both resolved decisions inline
  (`(D-03)`, `(D-04)`) in the design statements they shaped.
- The specification's `## Decisions (HOW phase)` section lists every ID
  consumed by this session — here, `D-03` and `D-04`.
- A missing pre-step `researcher` artifact does not block the HOW phase
  from running — `activity-grill` proceeds and would make its own
  bounded `researcher` call only if a question needed one (none did
  here).
