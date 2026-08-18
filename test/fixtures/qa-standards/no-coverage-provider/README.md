# Fixture: no coverage provider (AC-11 / SC-30 / SC-31 / SC-32)

No coverage provider is installed in any package, so measurement is impossible.
The structural path must still produce a risk-ranked gap inventory.

Expected `activity-coverage-gap-analysis` output:

- `coverage_gate: SKIPPED(<non-empty reason>)` -- never `PASS`
- a ranked inventory, never `unknown` or empty
- `packages/big-service` (900 LOC, no tests, handles auth and money) ranked
  above `packages/tiny-helper` (12 LOC, no tests)
- `packages/well-tested` absent from the gap list
- `stale-coverage-report/index.html` reported as **misleading**: generated months ago, and
  its command measures one module of three while presenting itself as the
  package's coverage
- `test_results.txt` reported as stale: claims 18 tests where the suite has more
- `.coverage` reported as a committed coverage database that `.gitignore` misses

## Why the report lives in `stale-coverage-report/`

The fixture's own `.gitignore` ignores `coverage/` on purpose — that is the
home-ledger sub-finding it reproduces. Placing the misleading report there would
have excluded it from version control, so a fresh clone could not reproduce
SC-32 at all. The artifact is therefore committed under `stale-coverage-report/`
and the ignored `coverage/` rule is retained for the `.coverage` finding.
