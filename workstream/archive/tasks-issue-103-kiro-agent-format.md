# Tasks: Adapt .kiro/agents to official Kiro custom agent format

**Issue:** #103
**Branch:** `issue/103-kiro-agent-format`

## Sub-tasks

- [x] 1. Remove non-standard `subagent` tool tag from `planner.md` and `product-engineer.md`
- [x] 2. Add `resources` field to all agent files with role-appropriate context declarations
- [x] 3. Add `permissions` field to agents where fine-grained scoping adds meaningful safety
- [x] 4. Validate and confirm `web` tool tag assignment across all agents
- [x] 5. Document the agent file format in `AGENTS.md` with reference to official docs
- [x] 6. Run quality gates and verify no functional regressions

## Acceptance Criteria

- [x] All agents use only official tool categories (`read`, `write`, `shell`, `web`)
- [x] All agents declare `resources` appropriate to their role
- [x] `AGENTS.md` documents the agent file format and links to official reference
- [x] No functional regressions — agents still work correctly in Kiro IDE
- [x] Non-standard `subagent` tag removed from all agents

## Relevant Files

- `.kiro/agents/developer.md` - Added resources field
- `.kiro/agents/github-ops.md` - Added resources field
- `.kiro/agents/housekeeping.md` - Added resources field
- `.kiro/agents/planner.md` - Removed subagent, added resources field
- `.kiro/agents/product-engineer.md` - Removed subagent, added resources and permissions fields
- `.kiro/agents/technical-writer.md` - Added resources field
- `.kiro/agents/ux-engineer.md` - Added resources field
- `.kiro/agents/verifier.md` - Added resources and permissions fields
- `AGENTS.md` - Added Agent File Format documentation section
