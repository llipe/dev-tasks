---
name: ux-scaffold
description: "Template-aware mockup project creation with DESIGN.md-derived tokens. Supports html-lite (zero-install, navigable) and react-full (shadcn + Vite + Radix). Use when generating mockups from a PRD or spec."
---

# UX Scaffold

## Purpose

Create mockup projects at the correct fidelity level, styled from DESIGN.md tokens via `ux-theme-gen` output, and structured as navigable screen sets rather than monolithic apps.

## When to Use

- `ux-engineer` invokes this after `ux-theme-gen` has produced theme artifacts.
- User explicitly requests a mockup scaffold.

## Templates

| Template        | Fidelity | Output                                        | Build step required              |
| --------------- | -------- | --------------------------------------------- | -------------------------------- |
| `html-lite`     | Low      | Self-contained HTML per screen + `index.html` | No — opens from `file://`        |
| `react-full`    | High     | Vite + React + shadcn/ui project              | Yes — `pnpm install && pnpm dev` |
| ~~`react-mid`~~ | —        | Cut (decision 2)                              | —                                |
| `react-native`  | —        | Reserved, not implemented                     | —                                |

## Scripts

### `scaffold-lite.sh`

```
Usage: ./scripts/scaffold-lite.sh <feature> <variant-num> <theme-css-path> <output-dir>
```

Generates:

- `<output-dir>/index.html` — entry point listing all screens with nav
- `<output-dir>/screen-<name>.html` — one per enumerated screen
- `<output-dir>/screen-map.md` — Mermaid flowchart of screen navigation

### `scaffold-full.sh`

```
Usage: ./scripts/scaffold-full.sh <feature> <variant-num> <output-dir>
```

Scaffolds a Vite + shadcn project. The script:

1. Creates the Vite app via `npm create vite@latest`.
2. Runs `pnpm install`.
3. Runs `shadcn@4.18.0 init --base radix --preset nova --css-variables --yes --silent` in the created dir.
4. Copies `ux-theme-gen` output (`theme.css`) into `src/index.css`, replacing the default token declarations.

## Screen Enumeration

Before scaffolding, the agent enumerates screens from the source artifact:

| Screen type        | Purpose                         |
| ------------------ | ------------------------------- |
| `happy`            | Primary flow, success state     |
| `error-validation` | Form validation failures        |
| `error-server`     | Server/network error states     |
| `error-permission` | Permission denied, unauthorized |
| `empty`            | No data, first-use experience   |
| `loading`          | Skeleton screens, spinners      |
| `edge-overflow`    | Long text, many items           |
| `edge-zero`        | Zero items, disabled states     |

Each screen becomes a named file (`screen-happy.html`, `screen-error-validation.html`, etc.).

## html-lite Navigation (Decision 2)

Lite output is a **browsable prototype**, not loose files:

- **`index.html`** — lists every screen with its purpose and the AC/story it satisfies, plus the screen map rendered inline.
- **Inter-screen links** — persistent nav strip on every screen: back to index, previous/next, and direct links to related states (e.g., happy → error-validation → empty).
- **Relative links only** — must work from `file://` with no server.
- **Current-screen indication** — highlighted in the nav strip.

## Annotations

Every screen section carries a machine-readable reference to the AC or story it satisfies:

- HTML: `<section data-ac="AC-3">` or `<!-- AC: AC-3 -->`
- React: `{/* @ac AC-3 */}` comment above the relevant JSX

## Theme Integration

- `html-lite`: reads `theme.css` and inlines the `:root` token values as a `<style>` block.
- `react-full`: `theme.css` replaces the shadcn-generated `:root` / `@theme inline` block in `src/index.css`.

Both templates **must not** contain hardcoded palette values. All styling derives from the theme output.

## Palette Inputs — Removed

The `palette` parameter and the `colorhunt.co` fallback are **removed**. DESIGN.md is the sole palette source. If DESIGN.md is unfilled, the agent runs the filling procedure rather than inventing a palette.

## Dependencies (react-full)

Pinned to the verified compatibility matrix:

| Package                    | Version | Notes                           |
| -------------------------- | ------- | ------------------------------- |
| `vite`                     | ^8      | via `create vite`               |
| `@vitejs/plugin-react`     | ^6      | Vite 8 only                     |
| `@tailwindcss/vite`        | ^4      | replaces postcss + autoprefixer |
| `tailwindcss`              | ^4      | CSS-first, no config file       |
| `shadcn`                   | 4.18.0  | pinned exactly; never @latest   |
| `radix-ui`                 | ^1.6    | unified package                 |
| `tw-animate-css`           | ^1.4    | replaces tailwindcss-animate    |
| `class-variance-authority` | ^0.7    |                                 |
| `clsx` + `tailwind-merge`  | latest  |                                 |
| `lucide-react`             | ^1.33   | icon library                    |

**Node requirement:** `>= 24` (shadcn CLI needs `>= 20.18.1`; repo floor is `>= 24`).

## Backward Compatibility

`webapp-mockup` has been removed. Use `ux-scaffold` directly with the appropriate template.

## Acceptance Checklist

- Scripts run non-interactively with no TTY
- html-lite produces valid standalone HTML viewable from `file://`
- index.html includes screen map + screen listing
- Inter-screen navigation works with relative links
- react-full uses shadcn CLI (pinned), not hand-rolled components
- No hardcoded palette in any scaffold output
- Every screen carries an AC/story annotation
- No `postcss`, `autoprefixer`, `tailwindcss-animate`, or `tailwindcss init -p`
