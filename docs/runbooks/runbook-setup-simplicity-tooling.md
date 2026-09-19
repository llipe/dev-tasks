---
name: runbook-setup-simplicity-tooling
trigger: A repository wants SIMPLICITY.md's section D thresholds enforced by CI instead of left to agent judgment.
owner: housekeeping
last_verified: 2026-09-19
related: ["SIMPLICITY.md"]
---

# Enforce the simplicity thresholds with tooling

`SIMPLICITY.md` section D lists thresholds that are deliberately _not_
prompt rules: "Do not restate them to the agent; failing CI is the
instruction." This runbook wires them into the lint gate.

It documents a capability dev-tasks does not ship yet — the thresholds are
stated in the contract, and the tooling that enforces them is configured per
repository. Treat the contract as the specification and this as the
configuration procedure; `last_verified` reflects the contract, not a shipped
implementation.

## Preconditions

- `SIMPLICITY.md` exists in the repository and has `status: filled`. An
  unfilled placeholder means no standard has been established, which is not
  the same as permission to skip.
- An ESLint (or equivalent) configuration already runs under `pnpm run lint`.
  These are additions to an existing gate, not a new one.
- Agreement on where to start. Turning all seven thresholds on at once in an
  existing codebase produces hundreds of errors and gets switched off within
  a day.

## Steps

1. Read section D and note which defaults your repository tightens. The
   defaults are: function length ≤ 40 lines, cyclomatic complexity ≤ 10,
   cognitive complexity ≤ 15, nesting depth ≤ 3, parameters ≤ 4, file length
   ≤ 400 lines, zero new dead code, zero forbidden `core` → `infra` imports,
   zero commented-out code.

2. Add the rules that map directly to stock lint rules first — they need no
   plugin:

   ```js
   // eslint.config.js
   rules: {
     "max-lines-per-function": ["error", { max: 40, skipBlankLines: true }],
     "max-depth": ["error", 3],
     "max-params": ["error", 4],
     "max-lines": ["error", { max: 400, skipBlankLines: true }],
     complexity: ["error", 10],
   }
   ```

3. Add the plugins for the rest: a cognitive-complexity plugin
   (`eslint-plugin-sonarjs`), dead-code detection (`knip` or `ts-prune`), and
   an import boundary checker (`dependency-cruiser`).

4. Run the gate and read the violation count before committing anything. If
   it is large, enable one rule at a time as `error` and fix as you go —
   never as `warn`, which is a threshold nobody enforces.

5. Wire dead-code and import-boundary checks into `pnpm run lint` so they
   fail the same gate. A check that runs only on request does not enforce
   anything.

## Verification

```bash
pnpm run lint
pnpm run validate
```

Both exit `0`. Then prove the rules actually fire — a misconfigured plugin
passes silently, which is worse than no plugin:

```bash
# temporarily add a 5-parameter function and confirm lint fails
pnpm run lint; echo "exit=$?"
```

Expect a non-zero exit naming `max-params`. Revert the probe afterwards.

## Rollback

Remove the rules from the lint configuration and uninstall the plugins.
Nothing else in the repository depends on them, and no generated state needs
cleaning up.

Do not roll back by demoting rules to `warn`. Either the threshold is
enforced or it is not; a warning is the state where everyone stops reading
the output.

## Escalation

A threshold that is wrong for your repository is a repository-level decision:
`SIMPLICITY.md` permits tightening a default but not loosening it, so raising
one is a change to the contract and needs the same review as any other
contract change. Record it as a decision rather than a quiet lint-config
edit.
