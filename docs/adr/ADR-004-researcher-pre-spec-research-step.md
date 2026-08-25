# ADR-004: Pre-spec codebase research step via `researcher` agent

## Status

Accepted

## Context

Agents writing specifications and task lists frequently lack grounded, file-level evidence about the existing codebase. This leads to:

- Specs that contradict existing implementation patterns.
- Task lists with incorrect dependency assumptions.
- Exploratory reading sessions that bloat the context window of implementation agents.

A bounded, delegated research step — run before spec generation or issue refinement — can produce a structured artifact that downstream agents consume without inheriting the full search transcript.

The step must not become mandatory, because trivial or greenfield work gains nothing from codebase investigation. It must not render verdicts (that's `verifier`'s role), and it must not modify any code or requirement documents.

## Decision

Add a `researcher` agent and a companion `activity-codebase-research` skill that:

1. Investigates a single focused research question against the codebase.
2. Addresses eight mandatory slices (components, APIs, UI, tests, data model, config, relationships, prior history).
3. Emits one artifact at `/workstream/research-*.md` with ten required sections, hard-capped at 250 lines and 30 cited files.
4. Records provenance (base branch, commit SHA) so consumers can detect staleness.
5. Is invoked conditionally by `product-engineer` (pre-refine in Issue Mode, pre-spec in Feature Mode), `developer` (troubleshooting), and `planner` (pre-orchestration).

The research step is recommended-and-conditional, never mandatory. It does not join the completion-gate sequence.

## Alternatives Considered

1. **Inline research within `product-engineer`:** Rejected because it bloats the orchestrator's context and prevents reuse by `developer` and `planner`.
2. **Mandatory research gate:** Rejected because it slows trivial issues without benefit.
3. **General web-research agent:** Rejected as out of scope. The agent is codebase-first; web findings are a secondary, attributed section.
4. **Extending `verifier` to do pre-spec research:** Rejected because `verifier` operates post-implementation and must remain independent of pre-implementation assumptions.

## Consequences

### Positive

- Downstream agents receive relevance-ranked, file-level evidence without inheriting search transcripts.
- The 250-line/30-file cap prevents the research artifact from being as expensive as the problem it solves.
- Provenance SHA enables staleness detection — consumers know when evidence is outdated.
- The conditional trigger policy prevents overhead on trivial changes.

### Negative

- Adds a tenth agent to the roster, increasing discovery surface for new users.
- On platforms without true subagent isolation (Kiro, Copilot), the context benefit is weaker than on Claude Code.
- Stale artifacts can mislead if consumers ignore the staleness rule.

### Follow-up actions

- Monitor whether the 250-line cap is sufficient for complex multi-module research.
- Consider archiving research artifacts to `workstream/archive/` on issue close.
- Revisit whether `verifier` Audit Mode should consume research artifacts as evidence (currently: no).

## Related

- Requirements: `workstream/issue-139-research-agent-refinement.md`
- Workstream: `workstream/tasks-issue-139-research-agent.md`
- Docs updated: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/system-overview.md`, `docs/workflow-chains.md`
