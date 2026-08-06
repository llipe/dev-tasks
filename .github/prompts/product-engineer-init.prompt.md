---
agent: product-engineer
description: "Initialize project foundation — create product-context.md and technical-guidelines.md."
---

Run the `product-engineer` agent to establish foundation documents for this project:

- **Project/product description:**
  > <Describe the product, project, or technology stack>

The agent will invoke the `activity-init` skill which first **detects the repository mode**:

- **Multi-repo** (`component.json` present): delegates context resolution to `dt init --task --json`
- **Mono-repo** (`/docs` present, no `component.json`): standard interview flow
- **Undocumented/greenfield** (neither): runs `dt extract detect` → `dt extract all --interactive` → interview

Then creates:

- `docs/product-context.md` — Product context and strategic goals
- `docs/technical-guidelines.md` — Technical standards and patterns

These documents serve as the "constitution" for all future development. Run this once per project or on major strategic/technical pivots.
