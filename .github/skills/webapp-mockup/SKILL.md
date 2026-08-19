---
name: webapp-mockup
description: "DEPRECATED — use ux-scaffold instead. This skill routes to ux-scaffold with fidelity: full for backward compatibility."
deprecated: true
successor: ux-scaffold
---

# Webapp Mockup (Deprecated)

> **This skill is deprecated.** Use `ux-scaffold` instead.
>
> `webapp-mockup` is retained for backward compatibility. Internally it routes
> to `ux-scaffold` with `fidelity: full` (the `react-full` template).
>
> Removal target: end of the 0.x release line.

## Migration

Replace invocations of `webapp-mockup` with `ux-scaffold`:

- For lightweight screens: invoke `ux-scaffold` with template `html-lite`.
- For interactive prototypes: invoke `ux-scaffold` with template `react-full`.

The `scaffold-mockup.sh` script in this directory is superseded by:
- `.github/skills/ux-scaffold/scripts/scaffold-full.sh`
- `.github/skills/ux-scaffold/scripts/scaffold-lite.sh`

## Differences from ux-scaffold

| webapp-mockup (old) | ux-scaffold (new) |
| --- | --- |
| One template (React + hardcoded palette) | Two templates: html-lite, react-full |
| `colorhunt.co` fallback palette | DESIGN.md is the sole token source |
| `tailwindcss-animate` + `postcss` | `tw-animate-css` + `@tailwindcss/vite` (Tailwind v4) |
| Per-component `@radix-ui/react-*` | Unified `radix-ui` package |
| Hand-rolled components in heredoc | `shadcn` CLI + `shadcn add` |
| No screen enumeration | Systematic screen types (happy/error/empty/loading/edge) |
| No annotations | AC/story references on every screen section |
| No inter-screen navigation | index.html + prev/next links (html-lite) |
