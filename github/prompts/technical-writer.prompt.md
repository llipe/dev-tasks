---
agent: technical-writer
description: "Audit and update /docs to reflect the current state of the codebase."
---

Run the `technical-writer` agent to synchronize documentation with the codebase.

Context for this pass *(provide one or more)*:

- **Feature / milestone completed:** `<feature name or milestone>`
- **Relevant workstream files:** `workstream/<file.md>`
- **PRD reference:** `docs/requirements/<prd-file.md>` *(optional)*

The agent will:

- Update `/docs` artifacts to reflect current implemented behavior
- Create a new ADR in `/docs/adr/` if `technical-guidelines.md` changed
- Update `/docs/user-guide/` for any user-visible changes
- Keep `mkdocs.yml` navigation in sync with pages on disk

`technical-writer` never modifies application code.
