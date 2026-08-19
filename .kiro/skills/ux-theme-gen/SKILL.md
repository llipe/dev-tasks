---
name: ux-theme-gen
description: "Generate platform-specific theme artifacts from DESIGN.md. Use when mockups or production code need consumable tokens derived from the canonical design contract."
---

# UX Theme Generation

## Purpose

Transform the YAML front matter in `/DESIGN.md` into consumable theme artifacts that mockups and production code import directly. This eliminates hand-copied colour values and keeps every surface aligned with the declared contract.

## When to Use

- Before generating any mockup (Phase 0 of `ux-engineer`).
- When `developer` needs production theme files aligned with DESIGN.md.
- After filling or updating DESIGN.md tokens.
- When a stale theme artifact is detected (its tokens don't match DESIGN.md).

## Inputs

| Input                                   | Required | Default            |
| --------------------------------------- | -------- | ------------------ |
| `/DESIGN.md`                            | yes      | —                  |
| `theme_output` path (from front matter) | no       | `/mockups/.theme/` |

## Contract Check (Must Run First)

Before generating any artifact:

1. Read `/DESIGN.md` front matter.
2. If `status: placeholder` → **refuse** with: "DESIGN.md is an unfilled placeholder. Run ux-engineer to fill it first."
3. If any `"<unfilled>"` sentinel remains in the token groups (`colors`, `typography`, `rounded`, `spacing`) → **refuse** and list the unfilled fields.
4. Resolve `{colors.x}` / `{typography.y}` style references. If a reference points to an unfilled or missing key → **refuse** and report the broken reference.
5. Only proceed to generation if all checks pass.

## Outputs

Generated into `{theme_output}` (default `/mockups/.theme/`):

| File          | Content                                                            | When                                             |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| `theme.css`   | `:root` token declarations + `@theme inline` block for Tailwind v4 | always                                           |
| `tokens.json` | Raw JSON: all token groups as a flat or nested object              | always                                           |
| `rn-theme.ts` | TypeScript theme object for React Native                           | only when `platform` includes `mobile` or `both` |

### `theme.css` structure

```css
/* DO NOT EDIT — generated from /DESIGN.md by ux-theme-gen */

@theme inline {
  --font-sans: "<fontFamily from typography.body-md>";
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ... one --color-* per semantic slot ... */
  --radius-sm: <rounded.sm>;
  --radius-md: <rounded.md>;
  --radius-lg: <rounded.lg>;
}

:root {
  --background: <colors.background>;
  --foreground: <colors.foreground>;
  --primary: <colors.primary>;
  --primary-foreground: <colors.primary-foreground>;
  /* ... all semantic slots ... */
  --radius: <rounded.md>;
}

.dark {
  /* dark-mode overrides if declared in DESIGN.md */
}
```

### Colour handling

- Emit colour values **exactly as declared** in DESIGN.md (hex, rgb, hsl, oklch — whatever the consumer wrote).
- Do **not** convert between colour spaces. `@theme` accepts any valid CSS colour.
- If DESIGN.md uses hex and the consumer later wants OKLCH, that is a DESIGN.md authoring decision, not a generator decision.

### Slot mapping

The semantic slots below are the ones Tailwind v4 + shadcn components consume via `@theme inline`. `ux-theme-gen` maps from DESIGN.md token names to these slots:

| DESIGN.md token                 | CSS variable               | @theme inline mapping                                           |
| ------------------------------- | -------------------------- | --------------------------------------------------------------- |
| `colors.background`             | `--background`             | `--color-background: var(--background)`                         |
| `colors.foreground`             | `--foreground`             | `--color-foreground: var(--foreground)`                         |
| `colors.primary`                | `--primary`                | `--color-primary: var(--primary)`                               |
| `colors.primary-foreground`     | `--primary-foreground`     | `--color-primary-foreground: var(--primary-foreground)`         |
| `colors.secondary`              | `--secondary`              | `--color-secondary: var(--secondary)`                           |
| `colors.secondary-foreground`   | `--secondary-foreground`   | `--color-secondary-foreground: var(--secondary-foreground)`     |
| `colors.muted`                  | `--muted`                  | `--color-muted: var(--muted)`                                   |
| `colors.muted-foreground`       | `--muted-foreground`       | `--color-muted-foreground: var(--muted-foreground)`             |
| `colors.accent`                 | `--accent`                 | `--color-accent: var(--accent)`                                 |
| `colors.accent-foreground`      | `--accent-foreground`      | `--color-accent-foreground: var(--accent-foreground)`           |
| `colors.destructive`            | `--destructive`            | `--color-destructive: var(--destructive)`                       |
| `colors.destructive-foreground` | `--destructive-foreground` | `--color-destructive-foreground: var(--destructive-foreground)` |
| `colors.border`                 | `--border`                 | `--color-border: var(--border)`                                 |
| `colors.input`                  | `--input`                  | `--color-input: var(--input)`                                   |
| `colors.ring`                   | `--ring`                   | `--color-ring: var(--ring)`                                     |
| `colors.card`                   | `--card`                   | `--color-card: var(--card)`                                     |
| `colors.card-foreground`        | `--card-foreground`        | `--color-card-foreground: var(--card-foreground)`               |

Tokens in `colors-extended` get their own `--<name>` variable in `:root` and a `--color-<name>` in `@theme inline`.

### `tokens.json` structure

```json
{
  "colors": { "background": "#...", "foreground": "#...", ... },
  "colors-extended": { ... },
  "typography": { ... },
  "rounded": { "sm": "6px", "md": "8px", "lg": "12px" },
  "spacing": { "xs": "4px", ... }
}
```

### Generated file header

Every generated file **MUST** start with:

```
/* DO NOT EDIT — generated from /DESIGN.md by ux-theme-gen */
```

(or the equivalent comment syntax for `.ts` / `.json`).

## Rules

1. **Read-only on DESIGN.md** — never modify the contract.
2. **Refuse on placeholder** — never generate from unfilled tokens.
3. **No colour-space conversion** — emit values as declared.
4. **Idempotent** — running twice with the same DESIGN.md produces byte-identical output.
5. **Regenerable** — hand-edits to generated files are findings; the correct fix is to update DESIGN.md and regenerate.
6. **Independent of mockup workflow** — `developer` can invoke this skill directly for production theming.

## Acceptance Checklist

- Contract check runs before any file is written
- Refuses against a placeholder or partially-unfilled DESIGN.md
- Generated `theme.css` uses `@theme inline` (Tailwind v4 pattern)
- Generated `tokens.json` is valid JSON with all token groups
- `rn-theme.ts` is only produced when `platform` includes `mobile` or `both`
- No hardcoded palette values exist in output (all derived from DESIGN.md)
- Every generated file carries the DO-NOT-EDIT header
- Output directory matches `theme_output` from front matter or defaults to `/mockups/.theme/`
