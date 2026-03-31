---
mode: agent
description: "Fix auto-fixable lint, type, and test-wiring issues without changing logic."
---

Run the `housekeeping` agent to perform a code-quality pass.

- **Target scope:** `<path/to/directory — leave blank for the full project>`

The agent will fix:

- Auto-fixable lint errors and formatting issues
- Missing type annotations and incorrect return types
- Broken test imports, wrong mock paths, and outdated snapshots (re-generated only)

The agent will **not** change test logic, business logic, or package versions without explicit confirmation. Logic changes and package upgrades are escalated with a clear report — never applied silently.
