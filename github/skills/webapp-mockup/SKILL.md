# Webapp Mockup Skill

Purpose
- Generate consistent, runnable React mockups for feature discovery and UI/functionality gap analysis.
- Produce partial, high-signal mockups with realistic UI artifacts: components, texts, transitions, popups, warnings, inputs, and validations.

When to use
- User asks to visualize a potential UI before full implementation.
- Team needs a browsable prototype to identify missing requirements.
- A feature section is still exploratory and should not include full backend flow.

Required behavior
1. Folder layout
- Create mockups only under:
  - /mockups/mockup-<feature>-<num>
- Keep each mockup self-contained and runnable with npm scripts.

2. Color palette rule
- If the project or user has not defined a palette, ask for one.
- Default fallback palette source:
  - https://colorhunt.co/palette/281c594e8d9c85c79aedf7bd

3. UI coverage requirements
- Include:
  - Core components (cards, buttons, inputs, labels)
  - Meaningful UI text and microcopy
  - Transition behavior (section reveal, popup open/close)
  - Popup/dialog examples
  - Warning and error states
  - Input validation states and messages
- No need to complete entire flow.
- If only a section is implemented, add a visible banner with instructions indicating this is a partial mockup and where to continue.

4. CSS references
- Ensure CSS files are referenced correctly from app entry/components.
- Keep any additional stylesheet imports explicit.

5. Consistency via scaffold script
- Use:
  - ./scripts/scaffold-mockup.sh <feature> <num> [palette_url]
- This script must be the default path for creating new mockups to keep structure and baseline behavior consistent.

Operational workflow
1. Confirm feature slug and mockup number.
2. Confirm palette or apply fallback URL.
3. Run scaffold script.
4. Implement or adjust the specific mockup section requested.
5. Verify app runs with npm run dev.
6. Summarize what is mocked vs intentionally not implemented.

Acceptance checklist
- Mockup path follows /mockups/mockup-<feature>-<num>
- App is runnable locally
- Palette is user-defined or fallback applied
- Banner exists for partial implementation
- Includes inputs + validations + warnings + popup + transitions
- CSS references are present and valid
