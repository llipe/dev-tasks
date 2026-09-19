---
agent: product-engineer
description: "Initialize project foundation — create product.md and tech.md."
---

Run the `product-engineer` agent to establish foundation documents for this project:

- **Project/product description:**
  > <Describe the product, project, or technology stack>

The agent will invoke the `activity-init` skill which first **detects the repository mode**:

- **Mono-repo** (`/docs` present): standard interview flow
- **Undocumented/greenfield** (`/docs` absent): investigates the codebase directly, then interview

Then creates:

- `docs/product.md` — Product context and strategic goals
- `docs/tech.md` — Technical standards and patterns

These documents serve as the "constitution" for all future development. Run this once per project or on major strategic/technical pivots.
