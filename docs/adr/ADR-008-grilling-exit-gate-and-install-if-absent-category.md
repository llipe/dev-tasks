# ADR-008: `activity-grill`'s hard exit gate, and the platform-agnostic install-if-absent category

## Status

Accepted

## Context

This ADR records two decisions that were settled together, pre-PRD, as one branch of the interview that produced `docs/requirements/prd-shared-understanding-refinement.md` (`shared-understanding#D-20`). They are unrelated in subject but were decided in the same sitting, so the PRD's own decision log paired them under one ADR rather than two.

**(a) The grilling exit gate is new in this phase.** `activity-grill` (Phase 2) interviews a developer one question at a time before `activity-refine` or `activity-generate-spec` drafts anything. Left unconstrained, "when is the interview over?" is the kind of question an agent answers by inference — a positive-toned reply, an emoji, a topic change — and each of those is a plausible-looking false positive that lets a PRD or spec get drafted against assumptions nobody actually confirmed. The PRD's FR-8 and its `AC-01`/`AC-02` acceptance criteria exist because this was flagged as the single highest-leverage rule in the whole skill: get the exit condition wrong and everything downstream (decision log, PRD, spec, task list) inherits an unconfirmed assumption stated as a settled decision.

**(b) The platform-agnostic install-if-absent category already shipped in Phase 1.** `core/distribution/profiles.ts` needed a way to deliver a file — originally `docs/runbooks/README.md` and `docs/runbooks/runbook-template.md` — that belongs to the repository, not to Copilot, Claude, or Kiro specifically, without the file being dropped when a single-platform profile installs or duplicated when several do. Rather than introduce a third delivery category alongside the existing platform-scoped one, Phase 1 reused the existing `ROOT_PROFILE_TAG` (see `core/distribution/profiles.ts`'s own doc comment on `AgnosticTag`, which explicitly names this reuse). That code shipped in Phase 1, working, without an ADR recording the decision — `shared-understanding#D-20` flagged this as a gap: a decision that "constrains future implementation choices across modules" (this file's own "When an ADR Is Required" rule) had gone unrecorded. This ADR's task for part (b) is documentation only: recording, retroactively, a decision that shipped a phase earlier, alongside the new decision it was originally paired with in the interview. No code changes accompany part (b).

## Decision

**(a) Exit gate:** `activity-grill`'s open-questions list is satisfied only when it is empty **and** the user has made an explicit statement of shared understanding. A positive-toned reply, an emoji, or silence does not satisfy it; the skill asks the direct confirmation question instead of inferring consent from tone (PRD FR-8, `AC-01`, `AC-02`). This is a hard gate with no auto-continue and no auto-stop path (FR-9 governs the separate question-cap behavior, not the exit gate itself).

**(b) Install-if-absent category:** a platform-agnostic, install-if-absent file is tagged with `ROOT_PROFILE_TAG` (exported from `core/distribution/profiles.ts`, typed as `AgnosticTag`) rather than a `Platform` value. An entry tagged this way is delivered exactly once per `install` run regardless of which profile (`copilot`, `claude`, `kiro`, `both`, `all`) is selected, and — per the install-if-absent contract distinct from `ROOT_FILES`'s unconditional overwrite — is written only when the target is missing, never overwritten once present. Shipped in Phase 1 as the delivery mechanism for `docs/runbooks/README.md` and `docs/runbooks/runbook-template.md`.

## Alternatives Considered

**(a) Exit gate:**

1. **Infer confirmation from sentiment/tone.** Rejected: the entire PRD-level risk this feature exists to close (see the PRD's own motivating problem) is an agent proceeding on an assumption it never actually got the user to confirm. Tone inference reintroduces exactly that failure mode inside the tool meant to prevent it.
2. **Timeout- or turn-count-based exit** (e.g., "if the user hasn't objected in N turns, proceed"). Rejected: silence is explicitly listed as a non-satisfying condition (FR-8) — the same reasoning as tone inference, since a timeout is inference from absence of signal rather than presence of one.
3. **Hard gate, explicit confirmation required.** Selected. Slower per session (an extra confirmation turn), traded deliberately for the correctness guarantee that no PRD/spec drafts against an unconfirmed assumption.

**(b) Install-if-absent category:**

1. **A third, dedicated `AgnosticPlatform` enum value** distinct from the existing `Platform` union. Rejected at delivery time: it duplicates the resolution logic `ROOT_PROFILE_TAG` already has (deliver once, independent of profile selection) for no behavioral difference.
2. **Tag with every `Platform` value simultaneously** (`copilot`, `claude`, `kiro`) so the file is "included" under any profile. Rejected: this is exactly the failure mode described in `core/distribution/profiles.ts`'s doc comment — dropped when installing a single-platform profile that isn't the first-listed one, duplicated when installing `all`.
3. **Reuse `ROOT_PROFILE_TAG`.** Selected (Phase 1). One existing mechanism already solves the identical problem (a file belonging to the repository, not a platform); a runbook is not conceptually different from any other root-owned file already using that tag.

## Consequences

Positive:

- (a) The exit-gate rule is now traceable to a durable architectural record, not only to the PRD's FR-8 text and the skill file's own prose — a future contributor changing `activity-grill` has one place that states the invariant and why it exists.
- (b) `ROOT_PROFILE_TAG`'s reuse for install-if-absent files is now documented at the decision level, closing the gap `shared-understanding#D-20` flagged, without requiring any code change or re-review of already-shipped Phase 1 behavior.

Negative:

- (a) Every grilling session pays one extra confirmation turn compared to inferring consent, even in the common case where the user's intent was genuinely already clear. This is an accepted, deliberate cost (see Alternatives).
- (b) This ADR documents Phase 1 code from inside a Phase 2 PR, which risks reading as a mismatched change scope. §8.7 of the Phase 2 specification and this document's own Context section state the split explicitly so a reader encountering the ADR standalone understands why.

Follow-up:

- None. Both decisions are closed; no open question remains from `shared-understanding#D-20`.

## Related

- Requirements: `docs/requirements/prd-shared-understanding-refinement.md` (FR-8, FR-9, `AC-01`, `AC-02`)
- Workstream: `workstream/decisions-shared-understanding.md` (`D-20`), `workstream/specification-shared-understanding-phase-2.md` (§8.7), `workstream/user-stories-shared-understanding-phase-2.md` (Story S-007)
- Docs updated: `docs/adr/README.md`, `docs/tech.md` (§ Grilling)
- Code: `.claude/skills/activity-grill/SKILL.md` (and `.github`/`.kiro` mirrors), `core/distribution/profiles.ts` (`ROOT_PROFILE_TAG`, `AgnosticTag`, unchanged by this ADR — documented only)
