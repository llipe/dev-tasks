# Scenario (i): a forbidden-synonym collision becomes a grilling question

**Verifies:** S-004-AC-1, S-004-AC-4 (FR-21, AC-08, D-61). Test-plan rows
E2E-5 (conflict path) and E2E-10 (read-only rule with a real glossary).

Walk this against `.claude/skills/activity-grill/SKILL.md` — step 3
(resolve-before-ask), step 3a (the FR-21 conflict rule), and the Write
Authority section. The conflict question is a behavior of the skill, not
of any executable, so the turns below are the contract: a skill revision
that would let the skill answer any of these itself, or that would let it
touch the glossary, is a regression.

## Setup

- Feature: `doc-index`, invented for this fixture. WHAT phase,
  `phase="WHAT"`, Feature Mode, cap 25.
- The glossary is populated — Phase 3 shipped, so the resolve-before-ask
  read is a real read, not a hedge.
- Two of its entries matter here, both under the bounded context
  `AI-assisted development workflow`:

```markdown
### foundation document

- Definition: A durable, repository-level document that states standing
  product or technical context, read by every agent before it drafts.
- Forbidden synonyms: product-context, technical-guidelines
- Invariants: Consumer-owned; never overwritten by `update`.
- Origin: `prd-shared-understanding-refinement.md` FR-44
- Status: active

### package map

- Definition: The table in `docs/tech.md` mapping each package to its
  bounded context.
- Forbidden synonyms: none
- Invariants: One row per package.
- Origin: `prd-shared-understanding-refinement.md` FR-60
- Status: active
```

## Step 1 — the WHAT-phase concept question (step 3a)

The branch `doc-index/scope` is settled. The skill asks the step 3a
question — one question, one recommendation, like every other:

> **Q (D-08):** Which domain concepts does this feature introduce or
> change? Name them as you would use them in the PRD.
>
> **Recommendation:** none yet — this is the question that produces the
> list; I will check each name you give against the glossary before we
> go further.

**User:** "Two. A *doc index*, which is the generated table of contents
for `docs/`. And the *product context*, which is the file the index has
to list first."

The skill appends `D-08` immediately (FR-4), then checks each named term
against the glossary before asking anything else.

## Step 2 — `doc index`: no glossary hit, no conflict

`doc index` is not an entry and is not named in any entry's forbidden
synonyms. Nothing fires. It is carried forward as a proposal for the
PRD's `## Vocabulary` section — which the caller writes, not this skill.

## Step 3 — `product context`: check (b) fires

Step 3a's second check: the term is not an entry of its own, but
`foundation document` names `product-context` among the synonyms it
forbids. That is a conflict, and a conflict is **surfaced as a question
with a recommendation** — the skill does not silently substitute
`foundation document`, does not silently accept `product context`, and
does not quietly rename anything:

> **Q (D-09):** You named *product context*. The glossary's
> `foundation document` entry lists `product-context` among its
> forbidden synonyms — the retired file name this vocabulary replaced.
> Do you mean the existing `foundation document` concept, or a genuinely
> new one that needs a different name?
>
> **Recommendation:** use `foundation document`. The thing you described
> — "the file the index has to list first" — is what that entry already
> defines, and the retired name is exactly what the forbidden-synonym
> rule exists to keep out of new PRDs.

**User:** "Right, it's the same thing. Use `foundation document`."

Appended immediately:

| ID   | Phase | Branch              | Question                                             | Recommended            | Answer                                                          | Accepted rec. | Supersedes | Author | Date       |
| ---- | ----- | ------------------- | ---------------------------------------------------- | ---------------------- | --------------------------------------------------------------- | ------------- | ---------- | ------ | ---------- |
| D-09 | WHAT  | doc-index/vocabulary | `product context` is a forbidden synonym of `foundation document` — same concept or a new one? | Use `foundation document` | Same concept; the PRD uses `foundation document` throughout. | yes           | —          | @user  | 2026-09-22 |

The PRD's Vocabulary row for this term is `conflict → doc-index#D-09`,
written by `activity-refine` when it drafts — not here.

### Counter-case, same step: the skill must not self-resolve

Had the skill treated the recommendation as the answer and moved on
without asking — appending `D-09` with `Accepted rec.: n/a` as a
self-resolution under step 3 — that would be a regression. Step 3's
self-resolution path covers questions the sources *answer*; a
forbidden-synonym hit is not an answer, it is a collision between two
things the user may legitimately have meant. FR-21 sends it to the user.

## Step 4 — edge case: same term, same definition

Later in the same session the user names *package map*: "the table in
`docs/tech.md` that says which package is in which bounded context."

Check (a) runs: the glossary has the term, and the **same definition** —
the user's phrasing matches what is recorded. No question fires; the
existing term is reused, and its PRD row will read `existing`. This is
resolve-before-ask doing its job (step 3), not a conflict. Asking here
would be the regression: the user would be made to re-decide something
the glossary already settled.

## Step 5 — edge case: one synonym forbidden by two entries

Suppose the glossary also carried a `steering document` entry whose
forbidden synonyms likewise included `product-context`. The user's
`product context` in step 3 would then collide with two entries.

The skill asks **one** question **naming both** owners:

> **Q (D-09):** You named *product context*. Two glossary entries forbid
> it as a synonym: `foundation document` and `steering document`. Which
> of the two do you mean — or is this a third concept?
>
> **Recommendation:** `foundation document`, per the definition you gave.

One conflict with two owners is one question. Two questions — one per
owning entry — would be batching by instalment, which FR-1 forbids just
as plainly as asking both in a single turn.

## What the session wrote

- `workstream/decisions-doc-index.md`: rows `D-08` and `D-09`.
- **No write to the glossary.** Not the new `doc index` proposal, not the
  `conflict` resolution, not a definition edit. `activity-grill`'s Write
  Authority is the decision log and nothing else; the glossary append is
  `activity-refine`'s write, made when the user approves the PRD (D-61).
  A revision that has this skill append a term mid-interview records
  vocabulary the user has not agreed to yet.
