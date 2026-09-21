# Scenario (c): "sounds good" after the open list empties — gate re-asks

**Verifies:** S-001-AC-6 (FR-8, AC-01/AC-02).

## Setup

- Feature: `widget-cache` (invented, trivial feature for this fixture).
- All branches in this phase have resolved; the open-questions list is
  empty.

## Transcript

```
[activity-grill, exit-gate attempt — decision-tree summary required, FR-6]
All branches resolved: widget-cache/storage-backend (D-01), ...,
widget-cache/error-fallback (D-30). Open list: empty.

[activity-grill -> user]
The open list is empty. Do you confirm shared understanding so I can
draft?

[user]
sounds good 👍

[activity-grill, gate check]
"sounds good 👍" is a positive-toned reply, not an explicit statement of
shared understanding. The exit gate is NOT satisfied — do not infer
confirmation from tone or an emoji.

[activity-grill -> user]
The open list is empty. Do you confirm shared understanding so I can
draft?

[user]
Yes, I confirm — proceed.

[activity-grill, gate check]
Explicit confirmation received. Exit gate satisfied.

[activity-grill -> caller]
exit gate satisfied
```

## Expected outcome

- The first "sounds good 👍" reply does **not** satisfy the exit gate —
  the skill re-asks the identical direct confirmation question rather
  than treating the reply as consent.
- Only an explicit statement of shared understanding satisfies the gate;
  the skill never proceeds to drafting on the strength of a positive-toned
  reply, an emoji-only reply, or silence.
- No new decision-log row is written for this exchange — the exit-gate
  question is not itself a design question with a `D-NN` row.
