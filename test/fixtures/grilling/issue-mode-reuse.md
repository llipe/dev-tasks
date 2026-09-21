# Scenario (d): Issue Mode reuses a matching prior decision

**Verifies:** S-001-AC-3, S-001-AC-7 (FR-10, AC-09).

## Setup

- Issue (fixture, invented): "Add rate limiting to the `widget-cache`
  invalidation endpoint."
- `activity-refine` Issue Refinement mode invokes
  `activity-grill(cap=8, mode="issue", feature="widget-cache")`.
- Prior decisions fixture: `decisions-other-feature.md` (this directory)
  contains `D-04` on branch `other-feature/rate-limit-response`, whose
  `Question` text shares the term "rate-limit" with the current issue
  description — the keyword gate matches it.

## Transcript

```
[activity-grill, Issue Mode, branch: widget-cache/rate-limit-response]
Question under consideration: "What HTTP status and body should a
rate-limited invalidation request receive?"

Step 3 resolve-before-ask, Issue Mode (mandatory prior-decision search,
FR-10):
  Keyword-gated scan of decisions-*.md: "rate-limit" shares a term with
  the issue description, so decisions-other-feature.md is read.
  Match found: other-feature#D-04 answers this exact question.
  -> resolved by reuse. Do not ask the user.

[activity-grill -> workstream/decisions-widget-cache.md, appended immediately]
| D-01 | WHAT | widget-cache/rate-limit-response | What HTTP status and
body should a rate-limited invalidation request receive? | n/a | Reused
other-feature#D-04: `429 Too Many Requests` with a `Retry-After` header
and JSON body `{ "error": "rate_limited" }`. | n/a | — | activity-grill |
<date> |

[activity-grill -> user]
(no message — nothing surfaced for this branch; the loop proceeds to the
next unresolved branch, still bounded by the Issue Mode cap of 8, or to
the exit-gate check if none remain)
```

## Expected outcome

- The question is resolved by reusing `other-feature#D-04` — cited in
  qualified cross-file form, `other-feature#D-04`, not the unqualified
  `D-04` (that form is reserved for inside the log's own file).
- The question is never surfaced to the user.
- The glossary is not touched (Issue Mode treats it read-only; this
  fixture proposes no new terms).
- The cap remains 8 for this session, per Issue Mode's default.
