# Scenario (h): `activity-refine` appends approved vocabulary to the glossary

**Verifies:** S-003-AC-2, S-003-AC-4 (FR-20, AC-07, FR-19, FR-63, D-61, D-65, D-68).

Walk this against `.claude/skills/activity-refine/SKILL.md` — sections
"Vocabulary Section" and "Approval Append" — and `core/checks/glossary.ts`
(`checkVocabularySection`). The append is a behavior of the skill, not of
any executable, so the diff below is the contract: a skill revision that
would produce a different glossary from these inputs is a regression.

## Setup

- Feature: `widget-cache`, continuing scenario (e)'s invented feature.
- `docs/tech.md` package map has one row whose `Bounded context` cell is
  `Widget management`. There is no row and no package named `Billing`.
- `docs/domain/ubiquitous-language.md` is the freshly installed template:
  frontmatter `version: 1.0`, `status: unfilled`, an empty `## Changelog`
  table, and zero terms. Zero terms is valid (D-66); `unfilled` means "no
  vocabulary established yet", never permission to invent one (D-68).

## Step 1 — the drafted PRD's Vocabulary section

WHAT-phase grilling produced two terms the user named, and one the user
did not. `activity-refine` drafts:

```markdown
## Vocabulary

| Term | Status in glossary | Bounded context | Definition (proposals only) | Forbidden synonyms (proposals only) |
| ---- | ------------------ | --------------- | --------------------------- | ----------------------------------- |
| cache entry | proposed | Widget management | One widget lookup result held for reuse until it is invalidated. | cached item, cache record |
| eviction | proposed | Widget management | Removal of a cache entry before its natural expiry, to reclaim space. | none |
```

`Forbidden synonyms: none` on `eviction` is an answer, not an omission —
the third proposal column is filled (UT-V7).

## Step 2 — the pre-review check (Final Instruction 4)

`activity-refine` runs `checkVocabularySection(prdMarkdown, glossaryMarkdown)`
before presenting the PRD. Both rows are `proposed` with all three
proposal columns non-empty, so:

```
checkVocabularySection -> { failures: [], staleness: [] }
```

Nothing is reported, and the PRD is presented for review.

### Counter-case, same step

Had the draft carried `| cache entry | proposed | Widget management | | none |`,
the check would have returned one `vocabulary-incomplete` and
`activity-refine` **must** report it to the user by that name before
presenting — not silently fix the row, and not present the PRD as if the
row were complete:

```
[vocabulary-incomplete] docs/requirements/prd-widget-cache.md: proposed
row 'cache entry' is missing definition. A proposal carries all three,
and 'none' is an answer.
```

Nothing is written to the glossary at this point. The PRD is drafted, not
approved, and the glossary grows on approval and never at draft time
(FR-20, D-61).

## Step 3 — the user approves

```
[user]
Approved.
```

## Step 4 — the append (exact diff)

`activity-refine` resolves `Widget management` against the `docs/tech.md`
package map — it matches the `Bounded context` cell of the one row — and
writes:

```diff
 ---
-version: 1.0
+version: 1.1
 name: Ubiquitous Language
 description: Canonical domain vocabulary, organized by bounded context. Append-only; terms are superseded, never deleted.
-status: unfilled
+status: active
 owner: product-engineer
 ---

 # Ubiquitous Language

 ## Changelog

 | Version | Date       | Summary | Author |
 | ------- | ---------- | ------- | ------ |
+| 1.1     | 2026-09-22 | +cache entry, +eviction | product-engineer |
+
+## Bounded Context: Widget management
+
+### cache entry
+
+- Definition: One widget lookup result held for reuse until it is invalidated.
+- Forbidden synonyms: cached item, cache record
+- Invariants: none
+- Origin: docs/requirements/prd-widget-cache.md
+- Status: active
+
+### eviction
+
+- Definition: Removal of a cache entry before its natural expiry, to reclaim space.
+- Forbidden synonyms: none
+- Invariants: none
+- Origin: docs/requirements/prd-widget-cache.md
+- Status: active
```

Four things in that diff are the contract, and each has its own reason:

- `Origin` is the PRD's path, not the decision ID — a reader who asks
  "why is this a term?" is sent to the document that argued for it.
- `Status: active` on both, because a term enters the glossary active.
- One changelog row, `+term` form, naming both terms. The `+term` grammar
  is what lets `checkGlossaryContent` detect a term that was added by a
  version and later deleted (FR-19, D-74).
- `status: unfilled` → `active`, once, on the first append (D-68).

The `## Bounded Context: Widget management` heading did not exist and was
created, because the context resolved against the package map (FR-63).

## Step 5 — `lint` after the append

```
$ pnpm run lint
$ echo $?
0
```

The glossary passes `checkGlossaryContent` (five fields per term, valid
`Status`, resolvable context, no duplicate, `+term` rows matched by body
terms), and the PRD passes `checkVocabularySection` — its rows are still
`proposed` at this point, which is the one thing the next step fixes.

## Step 6 — the PRD's rows become `existing`

`activity-refine` rewrites the two rows in the approved PRD:

```markdown
| cache entry | existing | | | |
| eviction | existing | | | |
```

This is not cosmetic. A `proposed` row for a term the glossary already
defines is `vocabulary-incomplete` with a "use `existing`" message (D-74),
so `lint` will insist on the rewrite. Re-running the append over this PRD
is then a no-op: there are no `proposed` rows left, so no entry and no
changelog row is duplicated (EC-32, D-16).

## Step 7 — a second PRD proposes `eviction` again

```markdown
| eviction | proposed | Widget management | Removal of a cache entry. | none |
```

The check reports:

```
[vocabulary-incomplete] docs/requirements/prd-widget-warmup.md: row
'eviction' is marked 'proposed' but docs/domain/ubiquitous-language.md
already defines it. Use 'existing'.
```

The second PRD does not get to redefine a term the first one established.
That is the whole point of the file: one term, one meaning, one
repository (D-16). The author changes the row to `existing` and, if they
disagree with the definition, raises it as a conflict during grilling —
where it becomes a question and a recorded decision (FR-21), never a
silent second definition.

## Step 8 — a proposal whose bounded context resolves to nothing

A later PRD proposes:

```markdown
| invoice | proposed | Billing | A statement of amounts owed. | none |
```

`checkVocabularySection` passes it — the row is structurally complete,
and the check knows nothing about the package map. The **append** is
where it stops. `activity-refine` resolves `Billing` against
`docs/tech.md`, finds no package name and no `Bounded context` cell that
matches, and **must not** create the heading:

```
Cannot append 'invoice': bounded context 'Billing' matches no package
name and no Bounded context value in the docs/tech.md package map.
Add the context to the package map, or name an existing one.
```

The glossary is unchanged — no heading, no entry, no changelog row, no
version bump. Creating the heading anyway would write a
`glossary-context-unresolved` failure into the file and hand the next
person a red `lint` they did not cause (EC-24, FR-63, D-66).
