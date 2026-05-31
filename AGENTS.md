# AGENTS.md — Baseline Standards for Hacker Dojo Grant Ops

This document defines the baseline rules and conventions for all development on this project. It is the authority for code quality, accessibility, security, and process standards.

## 1. TypeScript Standards

- **Strict mode is mandatory.** No `any`, no `@ts-ignore`, no `@ts-expect-error`, no weakening compiler settings.
- All code must pass `tsc --noEmit -p frontend/tsconfig.json` with zero errors.
- Use explicit types for all function parameters, return values, and public APIs.
- Zod validates all untrusted data: API payloads, query params, persisted artifacts, and external process output.

## 2. Code Quality

- No `console.log` in committed code. Use the structured logger (`frontend/src/lib/logger.ts`) for all logging.
- No commented-out code blocks. Remove dead code instead of commenting it out.
- No unused imports or variables.
- Prefer named exports over default exports except where Next.js conventions require defaults.
- One file should represent one primary concept.

## 3. Accessibility (WCAG 2.1 AA)

All interactive elements MUST be reachable and operable via keyboard:

- **Tab Order:** All interactive elements (buttons, links, form controls, custom widgets) must be reachable via Tab key.
- **Focus Indicators:** All interactive elements must have visible focus indicators. Do not suppress focus outlines without providing an alternative that meets 3:1 contrast ratio.
- **Escape Key:** Dialogs, menus, drawers, and overlays must close on Escape key press.
- **Arrow Keys:** Arrow keys must navigate within components where appropriate (tabs, menus, tree views, grids).
- **Enter/Space:** Interactive elements must respond to Enter and/or Space keys as appropriate for the role.
- **Semantic HTML First:** Use `<button>` for buttons, `<nav>` for navigation, `<main>` for main content, `<aside>` for complementary content, etc. Avoid div-as-button without proper ARIA.
- **Form Controls:** Every form control must have an associated `<label>` or `aria-label`/`aria-labelledby`.
- **Icon-Only Controls:** Must have an accessible name via `aria-label` or visually hidden text.
- **Live Regions:** Dynamic status updates (loading, errors, success messages, progress) must be exposed via `aria-live` regions (`polite` for updates, `assertive` for critical alerts).
- **ARIA Modal:** Overlays and dialogs must use `role="dialog"` and `aria-modal="true"`.
- **Page Structure:** Use proper heading hierarchy (h1-h6). Landmarks should be used (`<main>`, `<nav>`, `<aside>`, `<header>`, `<footer>`).
- **Skip Link:** Provide a "Skip to main content" link as the first focusable element.
- **Error Recovery:** Form errors should be announced to screen readers and focus should move to the first error.

## 4. Motion and Performance

- Animate only `transform` and `opacity` properties.
- Keep interaction feedback fast (under 100ms for feedback animations).
- Respect `prefers-reduced-motion` media query. Provide reduced or no motion alternatives.
- No layout-thrashing animations (avoid animating width, height, top, left, margin, padding).

## 5. Design System

- Use only design tokens defined in `frontend/src/app/globals.css` per `docs/product-spec-v2/08-design-system.md`.
- No hardcoded colors, spacing, or typography values.
- No Tailwind utility classes in application code.
- Typography tokens: Fraunces, Funnel Sans, JetBrains Mono only.
- No 'AI purple' colors (#7c3aed, #8b5cf6, #a855f7) anywhere.
- No Inter, Roboto, Arial, or Space Grotesk fonts.

## 6. React and Next.js Conventions

- Prefer Server Components for data assembly, static layout, and route-level composition.
- Mark with `'use client'` only when the component truly needs browser APIs, state, effects, or events.
- Keep server/client boundaries shallow and deliberate.
- Validate all API inputs with Zod.
- Use structured error handling with stable error shapes.
- Revalidate intentionally after writes; stale UI after mutation is a bug.

## 7. Testing

- Use Vitest for unit and integration tests.
- Use Playwright for end-to-end workflow tests.
- Write black-box tests: assert what the user can see, trigger, type, navigate, and recover from.
- Test via accessible roles, labels, and text.
- Every service and component should have a corresponding test file.
- Test success paths, failure paths, error states, loading states, empty states, and keyboard interactions.
- Bug fixes must add or strengthen a test.

## 8. Security

- The application binds to `127.0.0.1` only. Security relies on localhost-only binding plus machine-level protections.
- There is no application-level authentication, passcode, or lock screen.
- Never trust client input; validate all untrusted data server-side.
- No secrets or credentials in code.

## 9. Git Standards

- Never commit secrets, keys, or credentials.
- Never commit large binary files without explicit approval.
- Keep commits focused and atomic.
- Write descriptive commit messages.

## 10. File Structure

- Feature grouping over giant global folders.
- Tests mirror source names and live nearby.
- No `utils.ts`, `helpers.ts`, or `misc.ts` dumping grounds.
- Shared helpers must earn their abstraction.
