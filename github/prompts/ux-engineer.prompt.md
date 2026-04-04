Run the `ux-engineer` agent to convert requirements into testable mockups:

- **Source artifact path:** `<docs/requirements/prd-*.md | workstream/specification-*.md>`
- **Feature slug:** `<feature-slug>`
- **Number of variants:** `<1-3>`
- **Palette:** `<palette-url-or-hex-set>` *(optional; fallback will be used if omitted)*

Expected outputs:
- Mockups in `/mockups/mockup-<feature>-<num>`
- UX gap analysis and user-testing questions
- Refinement handoff file in `/workstream/ux-refinement-<feature>.md`
