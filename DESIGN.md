---
version: alpha
name: Dev Tasks UI Standard
description: Canonical visual contract for UI-related artifacts, mockups, and implementation guidance in this repository.
colors:
  primary: "#023047"
  secondary: "#219ebc"
  tertiary: "#fb8500"
  highlight: "#ffb703"
  soft-accent: "#8ecae6"
  surface: "#ffffff"
  surface-muted: "#f8fafc"
  text-primary: "#111827"
  text-inverse: "#ffffff"
  border-default: "#d1d5db"
  warning: "#fb8500"
  success: "#219ebc"
  focus-ring: "#219ebc"
typography:
  heading-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
  heading-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: 6px
  md: 8px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.text-inverse}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: 12px
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 16px
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 12px
  alert-warning:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
---

## Overview

The UI language is practical, clear, and operational. Screens should feel structured and trustworthy, with restrained brand accents and high readability for forms, instructions, and workflow-heavy interactions.

## Colors

Use neutral surfaces for content-heavy views and apply brand colors as accents for interaction, hierarchy, and status emphasis.

- `primary` is the app-shell and deep-brand color.
- `secondary` is the interactive accent (links, focus, secondary emphasis).
- `tertiary` is the primary CTA accent.
- `highlight` supports badges and attention markers.
- `soft-accent` is for subtle backgrounds and low-emphasis banners.

## Typography

Typography should prioritize clarity and hierarchy over decorative style. Use heading tokens for section hierarchy, body tokens for content and forms, and label tokens for controls and metadata.

## Layout

Layout is mobile-first and progressively enhanced at larger breakpoints. Prefer consistent spacing tokens and reusable shell patterns instead of one-off page geometry.

## Elevation & Depth

Depth should be subtle. Use light shadows and borders to separate cards and sections without creating visual noise.

## Shapes

Use consistent corner radii across related components. `rounded.md` is the default for inputs and buttons; `rounded.lg` is preferred for cards and grouped containers.

## Components

Component tokens define the baseline visual contract for primary controls and containers. Variants should be modeled as separate component entries when state-specific styling is needed.

## Do's and Don'ts

- Do keep contrast high for text and controls.
- Do preserve visible focus indicators and accessible state messaging.
- Do reuse tokens and component patterns before introducing new values.
- Don't introduce arbitrary hex values outside this file unless explicitly required.
- Don't mix incompatible button, spacing, or radius patterns within the same feature.
