---
version: alpha
name: Design Standard
description: Canonical visual and technical contract for UI artifacts, mockups, and implementation guidance in this repository.
status: placeholder
owner: ux-engineer
# ─── Technical contract ───────────────────────────────────────────────────────
platform: "<unfilled>" # web | mobile | both
framework: "<unfilled>" # react | react-native | html
css_approach: "<unfilled>" # tailwind | css-modules | styled-components | inline
component_library: "<unfilled>" # shadcn | chakra | mui | custom | none
primitive_base: "<unfilled>" # radix | base | aria — shadcn --base; only when component_library: shadcn
component_library_version: "<unfilled>" # pin exactly, never ^ or latest
theme_output: "<unfilled>" # where ux-theme-gen writes; default /mockups/.theme/
responsive_breakpoints:
  sm: "<unfilled>" # e.g. 640px
  md: "<unfilled>" # e.g. 768px
  lg: "<unfilled>" # e.g. 1024px
  xl: "<unfilled>" # e.g. 1280px
# ─── Visual tokens ────────────────────────────────────────────────────────────
# Semantic slot names below match shadcn/ui so generated themes can override
# them directly. Add project-specific extras under `colors-extended`.
colors:
  background: "<unfilled>"
  foreground: "<unfilled>"
  card: "<unfilled>"
  card-foreground: "<unfilled>"
  primary: "<unfilled>"
  primary-foreground: "<unfilled>"
  secondary: "<unfilled>"
  secondary-foreground: "<unfilled>"
  muted: "<unfilled>"
  muted-foreground: "<unfilled>"
  accent: "<unfilled>"
  accent-foreground: "<unfilled>"
  destructive: "<unfilled>"
  destructive-foreground: "<unfilled>"
  border: "<unfilled>"
  input: "<unfilled>"
  ring: "<unfilled>"
colors-extended: {} # project tokens with no shadcn slot; declare the mapping below
typography:
  heading-xl:
    fontFamily: "<unfilled>"
    fontSize: "<unfilled>"
    fontWeight: "<unfilled>"
    lineHeight: "<unfilled>"
  heading-md:
    fontFamily: "<unfilled>"
    fontSize: "<unfilled>"
    fontWeight: "<unfilled>"
    lineHeight: "<unfilled>"
  body-md:
    fontFamily: "<unfilled>"
    fontSize: "<unfilled>"
    fontWeight: "<unfilled>"
    lineHeight: "<unfilled>"
  body-sm:
    fontFamily: "<unfilled>"
    fontSize: "<unfilled>"
    fontWeight: "<unfilled>"
    lineHeight: "<unfilled>"
  label-sm:
    fontFamily: "<unfilled>"
    fontSize: "<unfilled>"
    fontWeight: "<unfilled>"
    lineHeight: "<unfilled>"
rounded:
  sm: "<unfilled>"
  md: "<unfilled>"
  lg: "<unfilled>"
spacing:
  xs: "<unfilled>"
  sm: "<unfilled>"
  md: "<unfilled>"
  lg: "<unfilled>"
  xl: "<unfilled>"
components: {} # component token overrides; see Components section
---

<!--
PLACEHOLDER. This file ships with dev-tasks as a section contract only — it
deliberately asserts no project-specific values.

Run `ux-engineer` to inspect this repository and fill it in. The agent audits
existing UI code for signal, presents inferred values as labelled proposals,
interviews you for the decisions it cannot infer, and writes this file only
after your explicit confirmation. It MUST NOT author a design system silently.

The sentinel for an unset value is the string "<unfilled>" in front matter and
`<!-- unfilled -->` in prose. `ux-theme-gen` refuses to generate while any
sentinel remains, and agents MUST treat `status: placeholder` as "no standard
established" rather than as permission.

Owned by `ux-engineer`. `developer` keeps it current when the visual contract
changes. Listed in `consumer_owned_paths`, so `dev-tasks update` will never
overwrite a version you have filled in.
-->

## Changelog

| Version | Date       | Summary                       | Author      |
| ------- | ---------- | ----------------------------- | ----------- |
| alpha   | —          | Shipped as an unfilled contract | dev-tasks |

Add a row on every change once filled.

## Overview

Describe the intended feel of the product in two or three sentences: how
structured or expressive it should be, how much visual weight to carry, and what
the reader should trust about a screen at a glance.

<!-- unfilled -->

## Colors

Declare how brand colour is applied versus neutral surface, and what each
semantic slot means in this product.

- `background` / `foreground` — base surface and its text
- `primary` — principal action and brand emphasis
- `secondary` — supporting emphasis and interactive accent
- `muted` — low-emphasis surfaces and secondary text
- `accent` — highlights and selected states
- `destructive` — irreversible and error affordances
- `border` / `input` / `ring` — separation and focus

Any token without a shadcn slot goes in `colors-extended`, with its purpose and
the slot it maps onto recorded here.

<!-- unfilled -->

## Typography

State the hierarchy and where each token is used. Prioritize clarity and
scanning over decorative range.

<!-- unfilled -->

## Layout

State the layout model, the breakpoint intent, and whether the product is
mobile-first or desktop-first.

<!-- unfilled -->

## Elevation and Depth

State how separation is expressed — borders, shadow, or spacing — and how much
depth is acceptable.

<!-- unfilled -->

## Shapes

State the radius convention and which radius belongs to which component family.

<!-- unfilled -->

## Components

Component tokens define the baseline visual contract for controls and
containers. Model state-specific styling as separate component entries rather
than as inline exceptions.

<!-- unfilled -->

## Voice and Tone

### Communication principles

- Register: <!-- unfilled --> (concise / friendly / formal / technical)
- Voice: <!-- unfilled --> (active preferred, and where passive is acceptable)
- Person: <!-- unfilled --> (first / second / third)

### Microcopy patterns

| Context              | Pattern                        | Example                                                        |
| -------------------- | ------------------------------ | -------------------------------------------------------------- |
| Success confirmation | <!-- unfilled -->              | "Changes saved."                                               |
| Error message        | cause + recovery action        | "Could not save. Check your connection and try again."         |
| Empty state          | state + next action            | "No transactions yet. Add your first one to get started."      |
| Loading              | <!-- unfilled -->              | "Loading your data..."                                         |
| Destructive action   | consequence + irreversibility  | "This permanently deletes X. This cannot be undone."           |
| Button labels        | verb or verb + noun            | "Save changes" / "Delete" / "Continue"                         |
| Placeholder text     | example-prefixed               | "e.g., john@example.com"                                       |

Examples above are defaults, not decisions — replace them with this product's
actual phrasing when filling the contract.

### Accessibility copy

- Every interactive element has a visible label.
- Error messages associate with their field via `aria-describedby`.
- Status messages use `aria-live` regions.
- Icon-only controls carry `sr-only` text alternatives.

## Technical Standards

### Framework and libraries

Values come from the front matter above. Record the reasoning here, especially
where the choice constrains future work.

- Platform: <!-- unfilled -->
- Framework: <!-- unfilled -->
- CSS approach: <!-- unfilled -->
- Component library and primitive base: <!-- unfilled -->

### Token consumption

- Mockups and production code **MUST** consume tokens from `ux-theme-gen`
  output, not from hand-copied values.
- Hardcoded colour or spacing values outside this file are findings.
- Generated theme files are derived artifacts. Regenerate them; never hand-edit.
- Colour values are emitted as declared here. `@theme` accepts any valid CSS
  colour, so no colour-space conversion is performed.

### File conventions

- Components `PascalCase`; files `kebab-case`.
- Web consumes CSS variables; React Native consumes the theme object.
- Mobile-first, progressively enhanced.

## Do's and Don'ts

- Do keep contrast high for text and controls.
- Do preserve visible focus indicators and accessible state messaging.
- Do reuse tokens and component patterns before introducing new values.
- Don't introduce arbitrary hex values outside this file.
- Don't mix incompatible button, spacing, or radius patterns within one feature.
