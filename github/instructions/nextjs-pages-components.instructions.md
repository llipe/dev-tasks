---
applyTo: "apps/management-hub/src/**/*.tsx"
---
# Rule: Keep Next.js Pages and React Components Consistent
> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).


## Goal

Guide GitHub Copilot when creating or editing Next.js pages and React components for the Management Hub so the UI stays consistent in:

- libraries and dependencies
- component patterns
- page structure
- styling conventions
- accessibility
- testing expectations
- general visual design

## Scope

Apply these rules to UI work inside `apps/management-hub/src/app` and `apps/management-hub/src/components`.

This project uses:

- **Next.js 16+** with **App Router**
- **React 19**
- **TypeScript strict mode**
- **Tailwind CSS** as the preferred styling foundation for page and component UI work
- **Zod** for validation
- local app components and utilities only

## Library and Dependency Rules

1. You **SHOULD** prefer the current stack only.
   - Use built-in React and Next.js APIs first.
   - Use existing local helpers from `@/lib/*` and local components from `@/components/*`.
   - Use `zod`-based validators from `@/lib/validation/*` for form validation.
   - Prefer `Tailwind CSS` for styling and visual consistency.

2. You **MUST** use Tailwind CSS as the default styling system.
   - Treat Tailwind as the standard foundation for layout, spacing, color, typography, and state styles.
   - Prefer utility classes over ad hoc CSS approaches for page and component implementation.
   - If reusable patterns emerge, extract local primitives in `apps/management-hub/src/components/ui`.

3. You **MUST NOT** introduce an opinionated component library by default.
   - You **MUST NOT** add MUI, Chakra UI, Ant Design, Radix wrappers, styled-components, Emotion, Framer Motion, or similar libraries unless the user explicitly asks for them.
   - You **MUST NOT** assume `shadcn/ui` is available unless it already exists in the app.
   - You **MUST NOT** introduce `shadcn/ui` by default. Reevaluate it only if the project explicitly chooses it as a product and engineering decision.

4. You **MUST NOT** solve simple UI problems with extra dependencies.
   - Prefer plain React components and existing utility-class styling.
   - If a reusable primitive is needed, create it locally in `apps/management-hub/src/components/ui`.

5. You **SHOULD** prefer local UI primitives before external component kits.
   - Build and reuse a small internal set of primitives such as `Button`, `Input`, `Card`, `Badge`, `Alert`, and `PageHeader`.
   - Keep those primitives aligned with the approved palette and accessibility rules.

6. You **MUST** keep app boundaries strict.
   - You **MUST NOT** import UI or business logic from `apps/shopify-app`.
   - Only use shared packages when they are already intended for cross-app use.

## Component and Page Architecture

### General Rules

1. You **MUST** default to Server Components.
   - Pages and components **SHOULD** remain server components unless they need client-only features.
   - You **MUST** add `'use client'` only when the component uses state, effects, browser APIs, event handlers, or client hooks such as `useRouter()`.

2. You **MUST** keep pages thin.
   - A page should primarily define metadata, route-level composition, and high-level layout.
   - Move repeated UI sections into components.
   - Move validation, formatting, mapping, and business rules into `@/lib`.

3. You **MUST** keep components focused.
   - One component should have one clear responsibility.
   - If JSX becomes long or repeats existing patterns, extract smaller subcomponents.

4. You **SHOULD** prefer composition over large monolithic components.
   - Build pages from small sections such as page header, content card, form section, status panel, or empty state.

5. **Use project import conventions**.
   - Prefer `@/` aliases for app-local imports.
   - Keep imports grouped as: React/Next, third-party, app-local.

### File Naming and Exports

1. Follow the **existing codebase convention** for file names:
   - component files: kebab-case, e.g. `login-form.tsx`, `auth-error-display.tsx`
   - page files: Next.js App Router defaults such as `page.tsx`, `layout.tsx`
   - test files: same base name with `.test.tsx`

2. Use **PascalCase** for exported React component names.
   - Example: file `login-form.tsx` exports `LoginForm`.

3. Keep related tests close to the page or component when practical.

## Next.js-Specific Rules

1. **Export `metadata` for pages when relevant**.
   - Public and major app pages should provide title and description.
   - Keep titles consistent with the product name: `E-Commerce Management Hub`.

2. **Use the right navigation primitive**.
   - Use `Link` from `next/link` for internal navigation in rendered UI.
   - Use `redirect()` in server-side route/page flows.
   - Use `useRouter()` only in client components when navigation must happen after a client event.

3. **Use App Router conventions**.
   - Route-level concerns stay in `src/app/...`.
   - Reusable UI goes in `src/components/...`.
   - Do not hide route-specific business logic inside presentational components.

4. **Prefer route-group consistency**.
   - Public auth screens should match the current auth page pattern.
   - Protected pages should match the existing protected layout and page shell.

5. **Prefer server-first data fetching**.
   - Fetch data in Server Components by default.
   - Use client-side fetching only when the UI requires interactive, user-driven, or live-updating state.
   - Do not move simple read-only page data fetching into client components unless there is a clear product need.

6. **Keep async boundaries intentional**.
   - Server Components should handle initial page data and route-level loading needs.
   - Client components should focus on interaction, optimistic UI, transient state, and browser-only behavior.

## Styling and Design Rules

1. **Follow the existing utility-class styling approach**.
   - Match the current class patterns already used across the Management Hub.
   - Do not introduce inline style objects unless there is no reasonable alternative.
   - You **MUST NOT** introduce CSS-in-JS.

2. **Use the approved Management Hub color palette**.
   - Base palette:
     - Sky Blue (Light): `#8ecae6`
     - Blue Green: `#219ebc`
     - Deep Space Blue: `#023047`
     - Amber Flame: `#ffb703`
     - Tiger Orange: `#fb8500`
   - Neutral surfaces:
     - Primary light surfaces should prefer white or near-white backgrounds.
     - Dark sections may use dark gray or near-black backgrounds when stronger contrast or emphasis is needed.
   - Semantic usage guidance:
     - Primary brand/background accent: Deep Space Blue
     - Secondary accent and interactive emphasis: Blue Green
     - Supporting light highlight/background tint: Sky Blue
     - Attention, highlights, badges, and positive energy moments: Amber Flame
     - Strong CTA, active emphasis, or warning-energy accent: Tiger Orange

3. **Translate the palette into a consistent UI language**.
   - Prefer white, off-white, dark gray, and near-black as the structural backgrounds.
   - Use the palette colors as accents, emphasis colors, and branded surfaces.
   - Avoid rainbow-like mixing of all five colors in the same component.
   - A single screen should usually have:
     - one dominant brand color
     - one supporting accent color
     - neutral backgrounds
   - Preserve readable contrast for text, borders, and interactive states.

4. **Preferred visual roles**.
   - App shell, headers, hero bands, and primary branded panels: Deep Space Blue
   - Links, secondary buttons, focus states, and info accents: Blue Green
   - Soft highlights, subtle banners, or decorative backgrounds: Sky Blue
   - Status chips, counters, feature highlights, and attention markers: Amber Flame
   - Primary CTA emphasis, strong hover accents, and promotional emphasis: Tiger Orange
   - Default content surfaces: white
   - Optional high-contrast surfaces: dark gray / black

5. **Preserve current layout patterns**.
   - Public/auth pages usually use a centered container with `min-h-screen`, a neutral background, and a card-style form panel.
   - Protected pages usually use a page shell with a header area, content cards, and responsive spacing.

6. **Prefer reusable visual patterns**.
   - Cards: `rounded-lg bg-white p-6 shadow`
   - Section headings: bold dark text with consistent margin spacing
   - Inputs: bordered, rounded, neutral background, visible focus state
   - Primary buttons: Tiger Orange or Deep Space Blue background with white text and clear disabled state
   - Secondary buttons: white or dark surface with Blue Green accents and visible border/focus styles
   - Alert panels: semantic border/background/text color combinations

7. You **MUST** avoid one-off visual decisions.
   - You **MUST NOT** invent a new color palette for a single page.
   - You **MUST NOT** mix drastically different spacing, corner radius, or button styles on similar screens.
   - You **MUST NOT** introduce arbitrary hex colors outside the approved palette unless the user explicitly requests it or accessibility requires it.
   - If a pattern repeats, you **SHOULD** extract a reusable component.

8. You **MUST** design mobile-first.
   - Start with small-screen layouts and scale up for tablet and desktop.
   - Every new page and major component should work across small, medium, and large breakpoints.
   - Prefer progressive enhancement of spacing, grid layout, and density instead of separate disconnected layouts.

9. **Use dark surfaces deliberately**.
   - Prefer dark gray or near-black backgrounds for app shell elements, navigation, hero sections, or emphasis panels.
   - Prefer light surfaces for dense forms, data entry, tables, and long-reading content unless a specific design requires otherwise.
   - Keep contrast high when palette accents are placed on dark backgrounds.

10. **Move toward reusable design tokens and shared patterns**.
   - When colors, spacing, radius, shadows, or typography styles repeat, prefer centralizing them through shared utility patterns or local primitives.
   - Avoid scattering slightly different visual values across many components.

## Forms and Validation

1. **Reuse validation patterns already present in the app**.
   - Use validators from `@/lib/validation/*`.
   - Keep validation messages explicit and user-friendly.
   - Validate before submitting.

2. **Keep form UX consistent**.
   - Use labels for every field.
   - Show inline field-level validation errors near the relevant field.
   - Show request or auth failures in a clear alert area.
   - Reflect loading and disabled states during submission.

3. **Do not put schema logic inside JSX files when it already belongs in `lib/validation`**.

4. **Use a consistent submission pattern**.
   - Prefer a single clear pattern per feature for form submission and mutation handling.
   - Keep form UI concerns in the component and keep request, validation, and transformation logic in route handlers, server actions, or `@/lib` helpers as appropriate.
   - Do not mix multiple submission patterns in the same feature without a clear reason.

## Accessibility Rules

1. Use semantic HTML first.
   - Use `main`, `section`, `header`, `form`, `label`, `button`, and heading levels correctly.

2. Every interactive element must be accessible.
   - Inputs must be associated with labels.
   - Buttons must have an explicit `type`.
   - Error messages should use `role="alert"` when appropriate.
   - Disabled and loading states must be visually and semantically clear.

3. Preserve keyboard and focus behavior.
   - Keep visible focus styles.
   - Do not remove focus indicators.

4. Prefer readable copy.
   - Avoid vague CTA text like `Submit` when a clearer label such as `Sign in` or `Save changes` is possible.

5. Keep interface copy concise and operational.
   - Prefer plain English.
   - Avoid overly promotional or marketing-heavy language in product screens.
   - Labels, helper text, empty states, and errors should be direct and specific.

## Data and State Rules

1. **Keep presentation separate from business logic**.
   - Formatting, validation, error mapping, and API transformations belong outside presentational JSX where possible.

2. **Keep client state minimal**.
   - Only store what the component truly owns.
   - Prefer derived state over duplicated state.

3. **Be explicit with empty, error, and loading states**.
   - Pages and components should not silently fail.

4. **Use consistent fallback state patterns**.
   - Empty states should explain what is missing and what the user can do next.
   - Loading states should use lightweight skeletons, placeholders, or progress text that match the surrounding layout.
   - Error states should clearly state the problem and, when possible, the next recovery action.

## Primitive Component Rules

1. Local primitives should follow a consistent API when applicable.
   - Support shared props such as `variant`, `size`, and `className` where those concepts make sense.
   - Forward native element props whenever practical.
   - Preserve accessible defaults.

2. Interactive primitives should support standard states.
   - Include disabled styles where relevant.
   - Include loading states for action-triggering controls when relevant.
   - Keep focus styles visible and consistent.

3. Do not create multiple competing primitive patterns.
   - Reuse or extend the existing primitive instead of creating a near-duplicate version.

## Icons and Motion

1. Icons are allowed, but they must stay consistent.
   - Prefer a single lightweight icon library across the app if one is introduced.
   - Do not mix multiple icon libraries in the same application.
   - If no icon library is present for the feature, prefer inline SVG or local icon components instead of adding a dependency casually.

2. Keep motion subtle.
   - Prefer simple CSS or utility-based transitions for hover, focus, expand/collapse, and feedback states.
   - Avoid heavy or decorative animation by default.
   - Do not add animation libraries unless the user explicitly requests them.

## Testing Rules

1. New pages and interactive components should include or update tests.
2. Use the existing Jest + Testing Library setup.
3. Prefer queries by role, label, and visible text.
4. Use `data-testid` only when semantic queries are not stable enough.
5. Test the user-visible behavior:
   - rendering
   - validation errors
   - loading states
   - disabled states
   - navigation intent
   - success and failure feedback

## Consistency Checklist

Before finishing a page or component, verify:

- It uses existing Next.js and React patterns.
- It does not add unnecessary dependencies.
- It matches current Management Hub styling.
- It uses semantic, accessible markup.
- It keeps business logic outside presentational code when possible.
- It reuses or extracts shared UI patterns instead of duplicating them.
- It includes or updates tests when behavior changes.

## Avoid These Defaults

- Adding a new UI framework without approval
- Adding custom design systems unrelated to current screens
- Mixing multiple styling approaches in the same feature
- Making every component a client component
- Putting API/business logic directly into presentational JSX
- Using internal `<a href>` links where `Link` is more appropriate
- Creating visually inconsistent buttons, cards, or form layouts

## Preferred Outcome

Every new Management Hub page or component should feel like it belongs to the same product:

- same stack
- same structure
- same interaction patterns
- same visual language
- same quality bar for accessibility and testing
