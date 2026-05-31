# React + Next.js Code Style Guide

> **Status:** Enforced standard for all new and modified frontend code
> **Applies to:** `frontend/src/**`, `frontend/next.config.ts`, frontend-facing shared types and helpers

This is the enforced frontend standard for this **Next.js + React + TypeScript** codebase. If a pattern conflicts with personal preference, the guide wins.

This document extends the baseline rules in [`AGENTS.md`](../AGENTS.md) and the UI constraints in [`docs/product-spec-v2/08-design-system.md`](./product-spec-v2/08-design-system.md).

## 1. Non-negotiable defaults

1. **TypeScript strict mode is mandatory.** No `any`, no `@ts-ignore`, no `@ts-expect-error`, no weakening compiler settings.
2. **Next.js rules outrank generic React habits.** This codebase uses the App Router, so route composition, metadata, loading states, and server/client boundaries should follow Next.js-first patterns.
3. **Server-first by default.** In Next.js, every component starts as a Server Component unless it truly needs client-only state, effects, DOM APIs, or browser events.
4. **`'use client'` is a cost, not a convenience.** Add it only when the component genuinely needs it.
5. **Black-box testability is a design requirement.** UI behavior should be testable through public inputs, rendered output, accessibility semantics, and user interactions rather than private internals.
6. **Zod validates all untrusted data.** API payloads, query params, persisted artifacts, and external process output must be validated at runtime.
7. **Accessibility is required, not deferred.** Every UI change must satisfy the WCAG and keyboard rules already defined in `AGENTS.md`.
8. **Design tokens only.** Use the established global tokens and system styling patterns. No ad hoc palette drift.
9. **New code should reduce complexity.** If you touch a file, leave it clearer than you found it.

## 2. Architecture rules

### 2.1 Next.js boundaries

- Prefer **Server Components** for data assembly, static layout, and route-level composition.
- Use **Client Components** only for:
  - local interactive state
  - effects
  - browser-only APIs
  - event-heavy UI
  - focus management and imperative DOM work
- Keep server/client boundaries shallow and deliberate. Do not turn entire pages into client components because one child needs interactivity.
- Fetch data on the server when possible. Avoid duplicating server-fetched data with immediate client refetches unless the UI truly needs live client synchronization.

### 2.2 Route design

- Organize by **feature and route intent**, not by generic technical buckets.
- App Router files should stay thin:
  - `page.tsx`: route composition
  - `layout.tsx`: shared shell and metadata
  - `loading.tsx`: route-level loading UI
  - `error.tsx`: route-level recovery boundary
  - `not-found.tsx`: explicit missing-resource UX
  - route handlers: input validation, orchestration, response shaping
- Do not hide route behavior inside deeply coupled utility layers with unclear ownership.

### 2.2.1 Mutations and server actions

- Prefer server-side mutations over client-orchestrated mutation flows when App Router patterns support it cleanly.
- Validate every action input on the server.
- Revalidation must be intentional after writes; stale UI after mutation is a bug.
- Mutation functions should return stable, testable result shapes.

### 2.3 API route rules

- Validate request input with Zod before doing work.
- Normalize error responses into stable shapes.
- Keep handlers orchestration-focused; move domain logic into dedicated services.
- Never trust client input because the app is local-first. Local does **not** mean safe.

## 3. React component rules

### 3.1 Component shape

- Prefer **small, focused components** with one clear responsibility.
- Extract subcomponents when a file mixes shell layout, business logic, and multiple visual regions.
- Prefer **composition over flags**. If a component needs many booleans to switch personalities, split it.
- Co-locate tests with the component under test.
- Do not define nested components inside render unless there is a compelling reason.

### 3.2 Props and typing

- Fully type props with explicit interfaces or type aliases.
- Use narrow unions for view state instead of loose strings.
- Mark props `readonly` when helpful for intent.
- Avoid “options bags” with many optional fields when the component really has multiple modes.

### 3.3 State

- Keep state as local as possible.
- Store the **minimum source of truth**; derive everything else.
- Use `useMemo` for expensive derivation only, not as decorative optimization.
- Use functional state updates when next state depends on previous state.
- Prefer reducer-style modeling when multiple state fields transition together.

### 3.4 Effects

- `useEffect` is for synchronization with external systems, not for ordinary derived state.
- Do not use effects to mirror props into state unless there is a proven UI reason.
- Effects must clean up timers, listeners, subscriptions, and async race conditions.
- If an effect is difficult to explain in one sentence, refactor the logic.

### 3.5 Event handlers

- Name handlers by user intent: `handleGrantSelect`, `handleSafeQuitConfirm`, `handleDismissNotification`.
- Keep JSX handlers thin. Move branching logic into named functions when it grows.

## 4. File and module structure

- Prefer **feature grouping** over giant global folders.
- One file should represent **one primary concept**.
- Shared helpers must earn their abstraction. Do not create `utils.ts`, `helpers.ts`, or `misc.ts` dumping grounds.
- File names should match their exported concept.
- Tests should mirror source names and live nearby when practical.

## 5. Data flow and side effects

- Use `Promise.all` when independent async work can run in parallel.
- Convert opaque response data into typed application data at the boundary.
- Keep fetch and parsing code out of presentational components where possible.
- When browser storage is used, isolate it behind small helpers and make failure behavior explicit.
- Silent failures are allowed only when the product behavior is intentionally resilient and the fallback is documented in code.

## 6. Styling rules

- Use the project’s **custom CSS and token system**; do not introduce Tailwind utility styling into application code.
- Prefer semantic class names tied to UI meaning, not implementation trivia.
- Avoid inline styles except for truly dynamic values that cannot be expressed cleanly through classes or tokens.
- Motion must follow the existing performance rules:
  - animate `transform` and `opacity`
  - keep interaction feedback fast
  - respect `prefers-reduced-motion`

## 7. Accessibility rules

- Use semantic HTML first.
- Every form control needs a label.
- Icon-only controls require an accessible name.
- Dialogs must manage focus correctly and support Escape.
- Keyboard navigation is not optional for menus, drawers, and overlays.
- Dynamic status updates must be exposed to assistive technology when relevant.

## 8. Testing rules

- Write tests for logic that can break, not just happy-path snapshots.
- Prefer behavior-focused tests over implementation-detail assertions.
- Favor **black-box tests**: assert what the user can see, trigger, type, navigate, and recover from.
- Test via accessible roles, labels, text, and workflows before reaching for implementation-specific selectors.
- Design components so important behavior does not require mocking private internals to verify it.
- Use:
  - **Vitest** for unit and integration tests
  - **Playwright** for user workflows
- For frontend tests:
  - verify visible behavior
  - verify keyboard interaction where relevant
  - verify error and loading states
- For route and mutation tests:
  - verify success, validation failure, and retry/recovery paths
  - verify cache invalidation or refreshed UI behavior after writes when applicable
- Every bug fix should add or strengthen a test when practical.

### 8.1 Black-box testability rules

- Prefer dependency seams at module boundaries, not deep object mocking.
- Presentational components should be testable from props in, DOM out.
- Hooks should expose stable state and actions, not leak hidden timing assumptions.
- Do not make tests depend on incidental class names, internal state structure, or hook ordering.
- If a component is hard to test without invasive mocking, that is usually a design smell.

## 9. Allowed patterns

- Server components for route composition
- Client components for interactive islands
- Zod schemas at API and artifact boundaries
- Feature-scoped helpers
- `useCallback` only when it improves correctness or prevents real churn
- `useMemo` only for non-trivial derivation
- Named exports by default, with Next.js-required defaults only where framework conventions demand them

## 10. Rejected patterns

These should be treated as review blockers unless there is a documented exception.

- Adding `'use client'` to a whole subtree for convenience
- Fetching on the client when the route can fetch on the server
- Copying props into local state without a synchronization reason
- Monolithic components that own unrelated views and workflows
- `any`, `unknown as SomeType`, or other type-escape shortcuts
- `console.log` in committed code
- Generic utility dumping grounds
- Tests that only prove implementation details while missing user-observable behavior
- Inline anonymous functions everywhere in complex JSX trees when named handlers would clarify intent
- CSS that bypasses tokens and invents one-off colors, spacing, or motion values
- Accessibility fixes postponed to “later”

## 11. PR review checklist

Before merging frontend work, confirm all of the following:

- Is this component server-first unless interactivity requires otherwise?
- Is every runtime boundary validated?
- Is the route using App Router conventions cleanly instead of recreating framework behavior manually?
- Is state minimal and derived cleanly?
- Are effects necessary and cleaned up?
- Does the UI follow the design system and motion guardrails?
- Does the change remain keyboard- and screen-reader-friendly?
- Are tests covering the user-visible risk in a black-box way?
- Did the change reduce or at least contain complexity?

## 12. Sources behind this guide

- React official docs: component purity, effects, state, composition, and server/client mental models
- Next.js official docs: App Router, Server Components, route handlers, and metadata patterns
- Existing repo standards in `AGENTS.md`
- Existing design and accessibility constraints in `docs/product-spec-v2/08-design-system.md`

If future code or docs contradict this guide, treat this guide as the enforcement target and update the outlier intentionally rather than drifting by accident.
