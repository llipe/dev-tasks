# Scenario (e): `activity-refine` PRD Creation mode blocks drafting until the exit gate is satisfied

**Verifies:** S-002-AC-1, S-002-AC-3 (FR-12, FR-14, AC-01, AC-05).

## Setup

- Feature: `widget-cache` (same invented, trivial feature as scenario (c),
  reused here for continuity).
- User gives `activity-refine` a short feature description: "Add a
  write-through cache in front of the widget lookup endpoint."
- `activity-refine` Mode B (PRD Creation) reaches Process step 2 and
  invokes `activity-grill(phase="WHAT", cap=cap.what)` before asking any
  clarifying question or producing any PRD content.

## Transcript

```
[activity-refine, Mode B, step 2]
Invoking activity-grill(phase="WHAT", cap=25) before any drafting.

[activity-grill, branch: widget-cache/storage-backend]
Question: "Where does the write-through cache live — in-process or a
shared store?"
Recommended: in-process (matches the feature's trivial scope; no shared
infra is described).

[user]
In-process, agreed.

[activity-grill -> workstream/decisions-widget-cache.md, appended]
| D-01 | WHAT | widget-cache/storage-backend | Where does the
write-through cache live? | in-process | in-process, agreed. | yes | — |
activity-grill | <date> |

[activity-grill, branch: widget-cache/error-fallback]
Question: "On a cache write failure, does the request still succeed?"
Recommended: yes — cache is a performance optimization, not a
correctness dependency.

[user]
Yes, agreed.

[activity-grill -> workstream/decisions-widget-cache.md, appended]
| D-02 | WHAT | widget-cache/error-fallback | On a cache write failure,
does the request still succeed? | yes | Yes, agreed. | yes | — |
activity-grill | <date> |

[activity-grill, exit-gate attempt]
Open list: empty.

[activity-grill -> user]
The open list is empty. Do you confirm shared understanding so I can
draft?

[user]
I confirm, proceed.

[activity-grill -> activity-refine]
exit gate satisfied

[activity-refine, Mode B, step 4 — only now, after the exit gate]
Generating PRD. Functional Requirements section states: "The write-through
cache MUST run in-process (D-01)." Non-Goals section states: "A cache
write failure MUST NOT fail the request (D-02)."

[activity-refine, PRD `## Decisions` section]
| ID   | Decision (short form)                          |
| ---- | ------------------------------------------------ |
| D-01 | Write-through cache runs in-process.              |
| D-02 | A cache write failure does not fail the request.  |
```

## Expected outcome

- No PRD section, draft, or outline is produced before the exit-gate
  confirmation — steps 3 (Reference Existing Documents) and 4 (Generate
  PRD) do not run until `activity-grill` returns satisfied.
- Once drafted, the PRD cites both resolved decisions inline (`(D-01)`,
  `(D-02)`) in the requirement/non-goal statements they shaped.
- The PRD's `## Decisions` section lists every ID consumed by the
  session — here, `D-01` and `D-02` — matching the table shape this
  repository's own PRDs and specs already use.
- A premature "sounds good" or silence at the exit-gate question would
  re-ask rather than proceed to step 4 (same invariant as scenario (c),
  now exercised through the `activity-refine` caller rather than
  `activity-grill` standalone).
