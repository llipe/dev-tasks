---
version: 1.1
name: Simplicity Standard
description: Canonical code-simplicity contract — decision rules, process rules, PR completion report, and tool-enforced thresholds.
status: filled
owner: housekeeping
---

# Code Simplicity & Maintainability Rules (global)

Scope: every code change produced by an agent. Repo-level rules may tighten these, never loosen them.

Core principle: code is read and changed far more often than written. Optimize for the next reader. The burden of proof is on adding, not on leaving out.

Every rule below has the form: condition → action → check. If you cannot verify a rule, you have not followed it.

Rule IDs (`A1`, `B3`, `D`) are cited by agents, verifiers, and PR bodies. They are append-only: a retired rule keeps its ID and is marked retired; IDs are never renumbered.

---

## A. Decision rules (agent judgment)

**A1. No reuse abstraction before the third use.**
Two similar blocks stay duplicated. On the third, extract. This rule governs abstractions introduced for reuse: shared helpers, utils, classes, and modules. Extracting an unexported, single-caller function is allowed when it is needed to satisfy a section D threshold or when it replaces a comment that A5 would otherwise require.
Check: every new exported helper/class/util in the diff has ≥3 real call sites in this change or existing code. Fewer → inline it.

```
❌ export function formatUserName(u) { return `${u.first} ${u.last}` }   // called once
✅ const name = `${user.first} ${user.last}`
```

**A2. No speculative surface area.**
No parameters, flags, options, env vars, config keys, or interfaces the current task does not exercise. "The future might need it" means it does not exist.
Check: every new parameter is passed with ≥2 distinct values somewhere in product code. Test code does not count. Otherwise remove it and hardcode.

**A3. No defensive code for impossible cases.**
Handle errors only where they can occur in the current flow and where the handler does something a caller cannot do better. Otherwise let it throw.
Check: for each new try/catch, null-check, or fallback, name the concrete input that triggers it. If you cannot, delete it.

```
❌ if (!items) return []; if (!Array.isArray(items)) return [];   // items is typed Item[]
✅ return items.filter(isActive)
```

**A4. Deep modules over many shallow ones.**
Prefer one module with a small interface and substantial implementation over several tiny modules that expose their internals. Splitting a 60-line function into six 10-line functions that only call each other is not simplification.
Check: the number of things a caller must know (exported names, params, types) went down or stayed flat. If exports grew faster than behavior, merge back.

**A5. Comments explain _why_, never _what_.**
If a comment restates the code, rename the symbol instead and delete the comment. Keep comments for non-obvious constraints, external quirks, and decisions that will look wrong to a future reader.
Check: read each comment with the code hidden. If the code alone would say the same thing, remove it.

```
❌ // increment retry counter
   retries++
✅ // Upstream returns 200 with an empty body on rate-limit; treat as retryable
   if (res.status === 200 && !body) retries++
```

**A6. Prefer values and pure functions; justify shared mutable state.**
Default to immutable data and functions that return results. Module-level mutable state, singletons, and in-place mutation of inputs require a one-line justification in the PR.
Check: search the diff for module-scope mutable bindings (e.g. `let` at module scope in JS/TS, module globals in Python), mutation of parameters, and global caches. Each occurrence has a justification or is removed.

**A7. Names carry intent.**
Names say what the thing is _for_, not how it is built. No `data`, `result`, `helper`, `manager`, `util`, `temp`, `info` as standalone names. Booleans read as predicates (`isExpired`, `hasAccess`).
Check: can a reader guess the type and purpose from the name alone without opening the definition?

**A8. Boundaries own conversions.**
Validation, parsing, and type coercion happen once at the edge (HTTP handler, CLI parser, queue consumer, file reader). Inside, data is already valid and typed; no re-validation.
Check: no schema parse, raw deserialization (e.g. `JSON.parse`), or type guard exists more than one layer inside an entrypoint.

**A9. Dependencies point inward and are earned.**
Core logic does not import framework, transport, or storage code. A new third-party dependency requires (a) and (b): (a) it replaces ≥50 lines you would otherwise write, or it implements something you must not write yourself (cryptography, time zones, parsers of standard formats, and similar correctness- or security-critical code); (b) it is stated in the PR. When in doubt whether a dependency is earned, ask for confirmation before adding it.
Check: the dependency manifest diff (e.g. `package.json`, `requirements.txt`, `go.mod`) is empty or every added line is justified.

**A10. Delete over deprecate, inside the boundary.**
When something becomes unused, remove it in the same change. No commented-out code, no `_old` suffixes, no feature flags left at a fixed value. This applies to internal code: if you are the only consumer, an unused symbol is dead code and is deleted. Public surface with external consumers (a published package, an exposed API, a contract other repositories depend on) follows the repository's versioning policy instead: deprecate, keep the alias for the published window, then delete. Contract stability for others outranks tidiness; tidiness for yourself outranks ceremony.
Check: the diff contains no commented-out code and no internal symbol with zero references. Any `@deprecated` in the diff points at a public surface and names the removal release.

**A11. Prefer synchronous until latency demands otherwise.**
Asynchrony buys throughput and costs a state machine, a retry policy, and a failure mode the next reader has to hold in their head. Reach for it when a measured latency or availability requirement needs it, not because the work sounds slow.
Check: for each async boundary added — queue, worker, background job, event — name the requirement it serves and the number it must hit. No number, make it synchronous.

```
❌ await queue.publish("welcome-email", { userId })   // no SLA; the handler is a 30ms insert
✅ await sendWelcomeEmail(userId)
```

**A12. Build for the load you have, plus one order of magnitude.**
Caches, queues, shards, read replicas, and connection pools answer measured pressure, not imagined growth. A slow query at small scale is acceptable and easy to fix later; an unnecessary cache is an invalidation bug waiting to happen.
Check: for each scaling mechanism in the diff, state the current load figure and the figure that justified it. No figure, remove it.

**A13. Security is never speculative; security theater is.**
The burden of proof on adding does not apply to a control that mitigates a real threat to this system. Authentication, authorization checks, validation at the boundary, secret handling, and safe defaults ship even when nothing is broken today, and A1 to A3 never justify dropping one. The burden does apply to a control that mitigates no named threat, or a layer added because it sounds safer.
Check: for each control, name the threat it stops. For each place a reader would expect one and finds none, say why. A control with no named threat is complexity; a missing control with no rationale is a defect.

---

## B. Process rules

**B1. Refactor and feature never share a commit.**
Behavior-preserving changes go in their own commit, labeled `refactor:`. If you touched behavior and structure in the same file, split the commit before opening the PR.
Check: `git log` of the branch shows structure changes and behavior changes as separate commits.

**B2. Untested code gets a characterization test before it is changed.**
If the code you are about to modify has no test covering the path you will touch, write one that captures current behavior first, commit it, then change.
Check: a test existed and passed against the original code before the modifying commit.

**B3. Smallest change that closes the task.**
Do not fix adjacent issues, reformat unrelated files, or "clean up while here". Record what you noticed and did not touch (see C).
Check: every changed file is required by the task. Unrelated diffs are reverted.

**B4. Plan before touching more than three files.**
State which files change and why, then implement. If implementation drifts from the plan, stop and re-plan; do not improvise across the codebase.
Check: the plan exists in the task record and the diff matches it, or the deviation is explained.

**B5. Reuse existing patterns.**
Before writing a new way to do something (logging, errors, config, HTTP calls, tests), find how the repo already does it and copy that. Consistency beats local optimality.
Check: for each new pattern, name the existing pattern you looked for and why it did not apply.

**B6. Make it runnable before you make it complete.**
A change nobody can run is a change nobody can check. Reach a state where the behavior can be exercised — a command, a route, a seeded local environment, a failing test — before widening the work. On a new component this comes before features; on an existing one it means the first increment is demonstrable rather than scaffolding.
Check: name the command a reader runs to see the behavior. If the answer is "once the rest lands", the increment is too large.

---

## C. Completion report (required in every PR description)

1. **What I did not add and why** — abstractions, options, error handling, or dependencies you considered and rejected under A1–A3, A9.
2. **What I noticed and did not touch** — issues outside scope, for a follow-up task.
3. **Justifications** — one line each for any shared mutable state (A6), new dependency (A9), or plan deviation (B4).
4. **Rules I could not verify** — say which check you could not run and why. This section is never empty: write `All checks passed` when nothing was skipped. A missing or empty section is a violation, not a pass.
5. **Exceptions** — every exception taken under section E, as rule ID plus one sentence. Write `None` when there are none.

An empty section 1 on a non-trivial change is a signal the task was over-built; expect review pushback.

---

## D. Enforced by tooling — not in the prompt

These are thresholds, not judgment. Configure them per repo (linter, complexity plugin, CI gate). Do not restate them to the agent; failing CI is the instruction. Test coverage thresholds are not here: they belong to `TESTING.md`, which owns every coverage number.

| Concern                          | Mechanism                          | Default (repo may tighten) |
| -------------------------------- | ---------------------------------- | -------------------------- |
| Function length                  | lint rule                          | ≤ 40 lines                 |
| Cyclomatic complexity            | lint plugin                        | ≤ 10 per function          |
| Cognitive complexity             | lint plugin                        | ≤ 15 per function          |
| Nesting depth                    | lint rule                          | ≤ 3                        |
| Parameters per function          | lint rule                          | ≤ 4                        |
| File length                      | lint rule                          | ≤ 400 lines                |
| Unused exports / dead code       | knip / vulture / ts-prune          | 0 new                      |
| Forbidden imports (core → infra) | dependency-cruiser / import-linter | 0                          |
| Commented-out code               | lint rule                          | 0                          |
| Formatting                       | prettier / black / ruff            | auto-fix, no diff noise    |

Duplication has no threshold here on purpose: A1 allows two copies until the third use, and a duplication gate would contradict it.

Rule of thumb: if a rule in section A or B needs more than two lines to explain, it belongs here as a tool, not there as prose.

---

## E. Exceptions

An exception is allowed when the rule's cost is higher than its benefit for a specific case. Every exception is stated in the PR completion report (section C, item 5) with the rule ID and one sentence. Unstated exceptions are violations. Repeated exceptions to the same rule are a signal to change the rule, not to keep excepting.
