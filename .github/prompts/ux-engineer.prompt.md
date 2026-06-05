Run the `ux-engineer` agent to convert requirements into testable mockups:

- **Source artifact path:** `<docs/requirements/prd-*.md | workstream/specification-*.md>`
- **Design standard path:** `<DESIGN.md>` _(optional; defaults to `/DESIGN.md`)_
- **Feature slug:** `<feature-slug>`
- **Number of variants:** `<1-3>`
- **Palette:** `<palette-url-or-hex-set>` _(optional; fallback will be used if omitted)_

Expected outputs:

- Mockups in `/mockups/mockup-<feature>-<num>`
- UX gap analysis and user-testing questions
- Refinement handoff file in `/workstream/ux-refinement-<feature>.md`
- DESIGN.md compliance notes and explicit deviations (if any)
