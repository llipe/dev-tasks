---
description: "Implement an existing task list interactively in the main thread, with step-gated approval after every sub-task. For autonomous per-story runs, /planner delegates to the developer subagent instead."
argument-hint: "<workstream/tasks-*.md> #<issue-number> (repo: owner/repo) [step-gated|autonomous]"
---

# /developer — Interactive Execution

> **Runs in the main thread** so it can stop after each sub-task and wait for your `yes`/`y` before continuing (step-gated is the default). This is the interactive counterpart to the `developer` **subagent**, which `/planner` uses for autonomous per-story execution where pausing per sub-task is not possible.

**Request:** $ARGUMENTS

Follow the full **`developer` agent contract** in `.claude/agents/developer.md` — every section (identity, required inputs, operating rules, execution flow, completion gate, output contract) applies unchanged in this main-thread run. Invoke the **`implement`** skill as step 0 of the execution flow before doing anything else.

Default execution mode is **step-gated** unless the request says `autonomous`/`pre-approved`. Delegate GitHub artifact operations to the `github-ops` subagent, complex git operations to the `git-ops` skill, and the pre-PR-ready documentation gate to the `technical-writer` subagent — per the agent contract.
