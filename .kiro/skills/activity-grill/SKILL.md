---
name: activity-grill
description: "Interview the user one question at a time, depth-first, resolve-before-ask, until every open design question is resolved and the user explicitly confirms shared understanding. Invoked by activity-refine (WHAT phase, Issue Mode) and activity-generate-spec (HOW phase)."
---

# Activity: Grill

Interview the user one question at a time — depth-first, resolve-before-ask, one recommendation per question — until every open design question is resolved and the user has explicitly confirmed shared understanding. `activity-grill` is a sub-skill invoked by `activity-refine` (WHAT phase, Issue Mode) and `activity-generate-spec` (HOW phase); it has no top-level entry point of its own.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Walk the design tree for a feature or issue to a state of genuine shared understanding, recorded as an auditable decision log, before the invoking skill drafts anything. The engine never batches questions, never infers confirmation from tone, and never silently decides on the user's behalf.

## Invocation

The caller passes:

- `phase` — `"WHAT"` (invoked by `activity-refine` PRD Creation mode, before drafting) or `"HOW"` (invoked by `activity-generate-spec`, before drafting). Both phases share one continuing ID space in the decision log — there is no phase-local restart (FR-7).
- `cap` — the question cap for this phase (see Cap Configuration below).
- `mode` — `"feature"` (default) or `"issue"` (Issue Mode, invoked by `activity-refine` Issue Refinement mode). Issue Mode is invoked without a `phase` argument — `activity-refine` passes `mode` and `cap` only.
- `feature` — the slug used to name `workstream/decisions-<feature>.md`.

## Context

This skill has no caller-specific behavior of its own — `activity-refine` and `activity-generate-spec` decide when to invoke it and what to do with a satisfied exit gate. This skill owns only: the question loop, resolve-before-ask precedence, the append-per-resolution write, the cap/summary/exit-gate mechanics, and the Issue Mode variant.

## Write Authority

- `workstream/decisions-<feature>.md` — append one row per resolved question, immediately (FR-4). Never batch writes to the end of a session.
- Nothing else. No PRD, spec, task list, code, or `/DESIGN.md` file may be created or modified by this skill.

## Process

### 1. One question, one recommendation, per turn (FR-1)

The skill never batches questions in one turn. Each question the skill cannot resolve itself is presented alone, with exactly one recommended answer attached, so the user can accept the recommendation or state a different answer in a single reply.

### 2. Depth-first traversal (FR-2)

A branch (e.g., `grilling/placement`, `simplicity/content` — the existing `Branch` column in `decisions-<feature>.md` already models this) is fully resolved, including any decision it depends on, before a sibling branch opens. Do not open a new branch while the current one has unresolved dependents.

### 3. Resolve-before-ask (FR-3)

Before asking the user anything, check in this order:

1. **Codebase directly** — `Read`/`Grep`/`Glob` for single-file questions (e.g., "does this config already exist?").
2. **`docs/product.md` / `docs/tech.md` / the glossary** for standing decisions already recorded there. All three are read here and written by none of them — the glossary in particular is consulted, never edited, in every mode (D-61).
3. **Prior `decisions-*.md` files** for a matching answer — mandatory in Issue Mode (FR-10), optional-but-recommended in Feature Mode.
4. **A bounded `researcher` call** — only when the question needs multi-slice evidence a single file read cannot supply, AND only if a fresh, non-stale pre-step `/workstream/research-*.md` artifact (if any) does not already cover it (D-56). At most one `researcher` call total per phase, shared with the caller's own conditional pre-step budget (ADR-004) — `activity-grill` is a second possible caller of `researcher`, not a second guaranteed invocation.

Only if none of the four resolve the question does the skill ask the user. A question whose codebase answer is ambiguous (multiple conflicting sources) is still asked to the user — the skill never guesses.

### 3a. Vocabulary conflicts are questions, never resolutions (FR-21)

This rule belongs to the two invocations where the feature's domain language is still being settled: the WHAT phase (`phase="WHAT"`) and Issue Mode (`mode="issue"`, which `activity-refine` invokes without a `phase` argument — see step 10). It does not run in the HOW phase.

Once the open branch reaches what the feature _is_, ask the user plainly **which domain concepts this feature introduces or changes** — one question, with a recommendation, like every other. For each term the user names, consult the glossary (step 3's second source) and check two things:

1. **The same term with a different definition** — the glossary already defines the term, and the definition the user just gave is not the recorded one.
2. **The term appearing in another term's forbidden synonyms** — the term is not an entry of its own, but an existing entry names it as a synonym it forbids.

Either hit is **surfaced as a question** with exactly one recommendation, and the user's answer becomes a `D-NN` row like any other resolution (step 4). A conflict is **never resolved silently**: the skill does not adopt the glossary's definition, does not adopt the user's, and does not quietly rename or merge the term. The term's `Status in glossary` is then `conflict → D-NN` in the drafted PRD — written later, by the caller, not here.

Two cases resolve without a new question, or with one question rather than several:

- **Same term, same definition.** The glossary already says what the user just said; nothing is asked and the existing term is reused. That is resolve-before-ask working (step 3), not a conflict.
- **One term forbidden by two entries.** A term named as a forbidden synonym by two different glossary entries raises **one** question naming both owning terms — one conflict with two owners, not two conflicts. Batching remains forbidden (FR-1).

The skill reads the glossary and writes nothing to it, in every mode and every phase — see Write Authority.

### 4. Append-per-resolution (FR-4)

Every resolved question — whether asked to the user or self-resolved via step 3 — becomes one row in `workstream/decisions-<feature>.md`, written immediately, not batched at the end of the session. A self-resolved row still gets a unique, never-reused `D-NN` ID; its `Accepted rec.` column is `n/a` and its `Answer` column states what was found and where (file, section, or prior decision ID). Row columns: ID, Phase, Branch, Question, Recommended, Answer, Accepted rec., Supersedes, Author, Date — the existing `decisions-<feature>.md` schema, unchanged by this skill.

### 5. Qualified citation form (FR-5)

Cite a decision as `<feature>#D-NN` everywhere outside that decision's own log file, and as the unqualified `D-NN` inside it — the convention `decisions-shared-understanding.md` already uses. A corrected decision never overwrites or renumbers its original row; it gets a new row whose `Supersedes` column names the superseded ID.

### 6. Decision-tree summary cadence (FR-6)

Every 10th resolved question, at the cap, and at the exit-gate attempt, the skill prints a decision-tree summary: resolved branches (each with its `D-NN`), the current branch, and the remaining open list. This is the only place the skill surfaces multiple prior questions at once — it is a summary of what already happened, not a new batch of questions.

### 7. Two-phase mode (FR-7)

`activity-grill(phase="WHAT")` runs before `activity-refine` drafts a PRD; `activity-grill(phase="HOW")` runs before `activity-generate-spec` drafts a specification. Each phase's questions continue the single ID space already present in the feature's decision log (e.g., D-01…D-27 WHAT, D-28… HOW) — never a phase-local restart.

### 8. Hard exit gate (FR-8)

The exit gate is satisfied only when **both** hold:

- The open-questions list is empty, **and**
- The user has made an explicit statement of shared understanding (e.g., "I understand, proceed" / "I confirm").

A "sounds good," an emoji, or silence after a decision-tree summary does **not** satisfy the gate. When the open list is empty, the skill asks directly: _"The open list is empty. Do you confirm shared understanding so I can draft?"_ If the user's reply is not an explicit confirmation, the skill re-asks the same direct question rather than treating the reply as consent — the gate is never inferred from tone or silence.

An empty open-questions list at invocation (nothing to grill) does not silently skip this gate — the direct confirmation question is still asked and must still be explicitly answered.

### 9. Configurable, enforced cap (FR-9)

Default cap: **25/25/8** — 25 questions per phase in Feature Mode (WHAT, HOW), 8 in Issue Mode. Read the configured cap from `docs/tech.md` § Grilling if that subsection exists; otherwise use the hardcoded default. If the configured value is 0 or non-positive, treat it as misconfiguration: fall back to the hardcoded default and note the fallback in the next decision-tree summary.

On reaching the cap, the skill presents the open list and asks the user to **continue (raise the cap) or stop (draft with what's settled, leaving the rest as recorded Open Questions)**. It never auto-continues and never auto-stops — the choice belongs to the user every time the cap is reached.

### 10. Issue Mode constraints (FR-10)

When `mode="issue"`:

- **Glossary is read-only.** No new term proposals. The glossary is consulted for resolve-before-ask and for the conflict checks in step 3a; a term the issue needs and the glossary lacks is a question for the user, never an edit made here.
- **Scope is limited** to what the issue changes relative to current behavior — do not open branches outside that delta.
- **Prior-decision reuse is mandatory, not optional.** Before asking, search prior decisions from _any_ feature's `decisions-*.md` for a reusable answer. The scan is keyword-gated: only logs whose `Branch` or `Question` text shares a term with the issue description are read, keeping the lookup bounded as the number of logs grows. A reused answer is cited in qualified form (`<other-feature>#D-NN`) and is not re-asked.
- The cap is 8, per the default above (or the configured `docs/tech.md` § Grilling issue-mode value).

### 11. Assumption-testing reminder (FR-11, SHOULD)

Once per phase, the skill states plainly that accepting every recommendation reproduces its own assumptions rather than testing them — a reminder, not a gate, and not repeated more than once per phase.

## Cap Configuration

| Mode               | Default cap | Configured source                     |
| ------------------ | ----------- | ------------------------------------- |
| Feature Mode, WHAT | 25          | `docs/tech.md` § Grilling, if present |
| Feature Mode, HOW  | 25          | `docs/tech.md` § Grilling, if present |
| Issue Mode         | 8           | `docs/tech.md` § Grilling, if present |

The 25/25/8 defaults apply whenever `docs/tech.md` has no § Grilling subsection, or the subsection's value for this mode is missing, zero, or negative (misconfiguration fallback, noted in the next decision-tree summary).

## Session State (D-54)

The open-questions list and the current depth-first tree position live only in the invoking conversation's turn-by-turn context. `workstream/decisions-<feature>.md` is the only persistent artifact this skill writes, appended to immediately per resolved question (FR-4). **Do not** create a separate `grill-state-<feature>.md` or any other working file to track session progress. If a session is interrupted and resumed, re-derive the open list by diffing what the PRD/spec still needs settled against what the decision log already has — the log is the source of truth for what is already resolved.

## Attribution (D-53)

No attribution is added anywhere in this skill for the `grill-me` interview pattern. This implementation is written independently from the PRD's own description of the desired behavior, not derived from any one repository's source; there is no single canonical `grill-me` project to credit, and several independent, differently-licensed reimplementations exist. Do not add a header credit line, footer note, or inline reference naming grill-me or any of its forks.

## Output

- Zero or more new rows appended to `workstream/decisions-<feature>.md`, one per resolved question, written as each question resolves.
- A returned exit-gate status to the caller: satisfied (open list empty and explicit confirmation received) or not yet satisfied.
- Zero or more decision-tree summaries printed to the conversation at the required cadence (every 10th resolution, cap, exit attempt).

## Non-Goals

- Not a drafting skill — produces no PRD, spec, or task-list content itself.
- Not a top-level entry point — only `activity-refine` and `activity-generate-spec` invoke it.
- Not a glossary editor — the glossary is read in every mode and written in none. Proposing a term into it is `activity-refine`'s write, made on the user's approval of a PRD, never mid-interview (D-61).
- Not a second, independent `researcher` budget — shares the phase's existing conditional pre-step budget (D-56, ADR-004).
