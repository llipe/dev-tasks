# Fixture: ac11

Hand-written, synthetic (D-95), for PRD AC-11 and S-014 AC-7. The expected
plan in `test/unit/migrate-projects/ac11-fixture.test.ts` was written by
hand from FR-19, spec §8.3 and §16a and this file, before `map.ts` and
`plan.ts` existed (RV-3). It is never regenerated from the code under test.

- One PRD (`alpha`, `docs/requirements/prd-alpha.md`), two roadmap waves:
  wave 1 `Done` (shipped: no wave issue, FR-19), wave 2 `In progress`.
- A pre-`level:` PRD tracking issue #1 labelled `type: prd` (D-87): reused,
  relabelled, never retitled.
- Six open stories: #10 and #11 by the `**Story:**` body line (plain and
  backticked with `→ S-NNN`, CRLF), #12 and #13 by a `phase: 2` label scoped
  to the `[PRD-alpha]` title prefix (D-98), #14 linked only by a milestone
  (stays unmapped: the milestone rule is dropped, D-98, task 4.3a) and #15
  linked by nothing (unmapped).
- One standalone bug #20 carrying `phase: 2` and a milestone: no `level:`,
  no parent (FR-19).
- Retired labels on open issues (`wave: 2`, `status: ready`,
  `needs: decision`) and one retired definition on no issue (`type: other`).
- #21 has no `type:`; #22 has two.
- Every issue body carries `BODY-SENTINEL-<n>` and `zebra-quartz`.

To change it, edit `repo.json` by hand and update the expected plan in the
test the same way, by hand.
