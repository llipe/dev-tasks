# Fixture: survey

Hand-written, synthetic. Not regenerated from the code under test, and
not taken from any real repository (D-95): it reproduces the shapes the
2026-10-23 survey found in the wild, with invented names and numbers.

- `repo.json` is the in-memory GitHub model that
  `test/unit/migrate-projects/helpers/fake-github.ts` serves reads from:
  labels, issues (open and closed, one pull request), parents, blocking
  relations, and the local files the `LocalReader` returns.
- Shapes covered: `Story S-NNN` titles without a `**Story:**` line,
  `phase:` labels on stories and follow-ups, one milestone shared by
  every wave, a pre-`level:` PRD tracking issue labelled `type: prd`, a
  wave tracking issue without `level:`, retired `status:` and `needs:`
  labels, zero- and two-`type:` issues, a `[chore]` title, a default
  unprefixed label, a `priority: critical` issue with and one without a
  blocking relation, and a closed wave tracking issue.
- Every issue body carries `BODY-SENTINEL-<n>` and the phrase
  `zebra-quartz`, so a test can prove no body reaches the plan file.

To change it, edit `repo.json` by hand and update the tests that name
its issue numbers.
