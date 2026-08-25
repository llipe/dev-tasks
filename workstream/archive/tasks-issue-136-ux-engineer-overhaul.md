# Tasks: Issue #136 — ux-engineer Overhaul

Branch: `issue/136-ux-engineer-overhaul` · PR: #137

## Phase 0 — DESIGN.md distribution  ✅ complete

- [x] 0.1 `package.json` `files` += `DESIGN.md`
- [x] 0.2 `core/distribution/profiles.ts` `ROOT_FILES` += `DESIGN.md`
- [x] 0.3 `scripts/build-bundle.sh` `MANAGED_FILES` += `DESIGN.md`
- [x] 0.4 `bundle-manifest.json` `consumer_owned_paths` += `DESIGN.md`
- [x] 0.5 Convert `DESIGN.md` to placeholder (`status: placeholder`, `<!-- unfilled -->`)
- [x] 0.6 Extend root-file distribution tests to cover `DESIGN.md`

## Phase 1 — Contract hardening  ✅ complete

- [x] 1.1 New front matter fields (`status`, `owner`, `platform`, `framework`, `css_approach`, `component_library`, `primitive_base`, `component_library_version`, `theme_output`, `responsive_breakpoints`)
- [x] 1.2 Voice and Tone section
- [x] 1.3 Technical Standards section

## Phase 2  ✅ complete — ux-theme-gen skill

- [x] 2.1 SKILL.md in `.github/skills/ux-theme-gen/`
- [x] 2.2 Mirror to `.claude/` and `.kiro/`
- [x] 2.3 Parity test

## Phase 3  ✅ complete — ux-scaffold skill

- [x] 3.1 SKILL.md in `.github/skills/ux-scaffold/`
- [x] 3.2 `scripts/scaffold-lite.sh` (html-lite, navigable, zero-install)
- [x] 3.3 `scripts/scaffold-full.sh` (shadcn 4.18.0 + Vite + Radix)
- [x] 3.4 Mirror to `.claude/` and `.kiro/` incl. scripts (closes Kiro gap)
- [x] 3.5 Deprecate `webapp-mockup` as alias
- [x] 3.6 Parity test

## Phase 4  ✅ complete — ux-engineer agent

- [x] 4.1 Rewrite `.github/agents/ux-engineer.agent.md`
- [x] 4.2 Mirror to `.claude/` and `.kiro/`
- [x] 4.3 Parity test

## Phase 5  ✅ complete — Integration and docs

- [x] 5.1 `activity-refine` UI-scope detection (3 trees)
- [x] 5.2 `product-engineer` Phase 2.5 suggestion (3 trees)
- [x] 5.3 README.md tables
- [x] 5.4 AGENTS.md tables + ownership
- [ ] 5.5 `docs/workflow-chains.md`, `docs/system-overview.md`
- [x] 5.6 `.gitignore` mockup entries

## Relevant Files

- `package.json`, `bundle-manifest.json`, `core/distribution/profiles.ts`, `scripts/build-bundle.sh`
- `DESIGN.md`
- `.github/skills/ux-scaffold/`, `.github/skills/ux-theme-gen/` (+ `.claude/`, `.kiro/` mirrors)
- `.github/agents/ux-engineer.agent.md` (+ mirrors)
- `test/unit/distribution-install.test.ts`, new parity tests
