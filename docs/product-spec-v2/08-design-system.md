# 08 — Design System

> **Aesthetic Direction**: Warm dark, industrial-refined — like a makerspace after hours. Gold accent lighting against deep charcoal. Typography-led, spatially confident, unapologetically distinctive. NOT a corporate SaaS dashboard.

## Skill Hierarchy

This design system is governed by a hierarchy of design skills. When skills conflict, the PRIMARY skill takes precedence.

| Priority | Skill | Role |
|---|---|---|
| **PRIMARY** | `frontend-design` | Aesthetic direction, typography, color, spatial composition, motion philosophy, anti-slop |
| **GUARDRAIL** | `baseline-ui` | Component primitives, interaction patterns, animation performance constraints |
| **GUARDRAIL** | `fixing-motion-performance` | Compositor-only animation, no layout thrashing, scroll performance |
| **GUARDRAIL** | `accessibility` + `fixing-accessibility` | WCAG 2.2 AA compliance, keyboard, screen reader, focus management |

**How conflicts are resolved**: Frontend-design sets the creative direction. Guardrail skills constrain *how* that direction is executed (never animate layout properties, always meet contrast ratios, always use accessible primitives) — but they do NOT override aesthetic choices. We use gradients by design. We use motion by design. We use custom CSS by design. These are intentional frontend-design choices, not violations.

---

## 1. Aesthetic Direction & Anti-Slop Rules *(from frontend-design)*

### 1.1 — Commit to the Direction

**Rule D1 — BOLD AESTHETIC**: The design is **dark and warm**. Every component, every state, every empty view must feel like it belongs in a makerspace at night. This is the conceptual direction — execute it with precision and intentionality. Bold maximalism and refined minimalism both work; the key is intentionality, not intensity.

**Rule D2 — TYPOGRAPHY AS DIFFERENTIATOR**: Typography is the primary visual differentiator. **Fraunces** (serif) carries presence and editorial weight for titles, KPIs, and drawer headers. **Funnel Sans** (sans-serif) provides clean readability for body, buttons, and UI controls. **JetBrains Mono** (monospace) signals precision for labels, codes, funder names, and data. These three fonts are the only fonts used. They are distinctive, beautiful, and unexpected — exactly what frontend-design demands.

**Rule D3 — COLOR**: Commit to a cohesive palette. Gold (#d4a943) is the sole accent color — dominant and sharp, not timid. Semantic colors (success, warning, danger, info) are used only to convey state, never as decoration. This is a dark-dominant palette with a single sharp accent — not an evenly-distributed, timid palette.

**Rule D4 — SPATIAL**: Unexpected layouts. Asymmetry where it creates interest. The sidebar creates left-weight; the main content area is generous and open. Panels use controlled density. Generous negative space is intentional — do not reduce it to "fit more content."

**Rule D5 — BACKGROUND ATMOSPHERE** *(from frontend-design)*: Create depth and atmosphere rather than defaulting to solid colors. The two radial gradients (gold at top-left, blue at bottom-right, both at low opacity) establish the makerspace-at-night feeling. Solid color backgrounds are only for surfaces (cards, panels), never for the page body.

**Rule D6 — VISUAL DETAILS** *(from frontend-design)*: Layer contextual effects that match the makerspace aesthetic:
- **Geometric patterns**: subtle circuit-board or maker-themed line patterns on empty states or hero areas
- **Noise/grain textures**: light grain overlay on surfaces for tactile depth (≤ 3% opacity, non-distracting)
- **Layered transparencies**: semi-transparent borders, glass-like surface overlays for depth
- **Dramatic shadows**: deep, warm-toned box-shadows on elevated cards (not generic gray drop-shadows)
- **Decorative borders**: subtle gold accent lines separating sections, not heavy full-width dividers

These are enhancements, not requirements. Apply where they elevate the aesthetic — never add decoration that fights the content for attention.

**Rule D7 — MOTION PHILOSOPHY** *(from frontend-design)*: Use motion for high-impact moments. One well-orchestrated page load with staggered reveals (`animation-delay`) creates more delight than scattered micro-interactions. Use scroll-triggered reveals and hover states that surprise. Motion is part of the aesthetic identity — it is NOT "decoration that can be removed." Prefer CSS-only solutions; use Motion library for React when CSS alone can't achieve the effect.

**Rule D8 — COMPLEXITY MATCHING** *(from frontend-design)*: Match implementation complexity to the aesthetic vision. The makerspace-at-night concept is refined, not maximalist. It demands precision, careful attention to spacing and typography, and subtle atmospheric details. Elegance comes from executing the vision well, not from adding more effects. Every visual detail must serve the concept — if it doesn't reinforce "makerspace at night," it doesn't belong.

**Rule D9 — ANTI-SLOP** *(from frontend-design)*: The following are NEVER used anywhere in the application. These are the hallmarks of generic AI-generated UI and have no place in a distinctive, context-specific design:
- ❌ Inter, Roboto, Arial, Space Grotesk, or system fonts as primary typefaces
- ❌ Purple gradients on white backgrounds (the most overused AI aesthetic)
- ❌ Cookie-cutter SaaS layouts (hero image → 3 feature cards → CTA)
- ❌ Glow effects as primary affordances
- ❌ Multicolor gradients or rainbow color schemes
- ❌ Predictable, timid, evenly-distributed color palettes
- ❌ Generic component patterns that could belong to any app
- ❌ "AI purple" (#7c3aed, #8b5cf6, #a855f7) in any form

If a component could have come from any SaaS app, it is wrong for Hacker Dojo Grant Ops. Every design choice must feel intentional and specific to this context.

---

## 2. Design Tokens

### 2.1 — Color Palette

```css
:root {
  /* Backgrounds — warm dark, like a makerspace at night */
  --bg: #1c1a17;
  --bg-2: #221f1a;
  --surface: #25221d;
  --surface-2: #2c2922;

  /* Borders */
  --border: #36322c;
  --border-light: #443f37;

  /* Text — warm paper-like */
  --text: #ebe6dc;
  --text-dim: #b3ac9e;
  --text-muted: #807a6d;

  /* Accent — gold, like warm lighting. ONE accent per view. */
  --accent: #d4a943;
  --accent-dim: #8a6f2d;

  /* Semantic — used sparingly, not as decoration */
  --success: #8aab6f;
  --warning: #e0894a;
  --danger: #c66b5a;
  --info: #7ba3b8;
}
```

**Rule D8 — COLOR**: Semantic colors (success, warning, danger, info) are used ONLY to convey state. They are never used as decoration or branding. Gold is the only brand accent.

**Rule D9 — COLOR**: The gold accent appears on at most one primary element per view (the primary CTA button, or the active nav item, or a KPI card bar). It is not scattered across multiple unrelated elements.

### 2.2 — Typography

| Token | Font Stack | Usage | Rules |
|---|---|---|---|
| `--serif` | `'Fraunces', Georgia, serif` | Page titles, KPI values, drawer titles | **text-balance** on headings |
| `--sans` | `'Funnel Sans', system-ui, sans-serif` | Body text, buttons, labels, UI controls | **text-pretty** on paragraphs |
| `--mono` | `'JetBrains Mono', ui-monospace, monospace` | Labels, funder names, codes, data | **tabular-nums** on all data |

**Type Scale** (no arbitrary sizes):
- 38px: page titles (h1)
- 26px: drawer titles
- 22px: brand mark
- 17px: panel titles
- 14px: body default
- 13.5px: nav items
- 13px: table content
- 12px: meta text
- 11px: sub-headers
- 10px: labels, badges
- 9px: tags

**Rule D10 — TYPOGRAPHY**: NEVER modify `letter-spacing` unless explicitly approved. The fonts are chosen for their native spacing.

**Rule D11 — TYPOGRAPHY**: Use `text-balance` on all headings, `text-pretty` on all body/paragraph text, `tabular-nums` on all numeric data displays, `truncate` or `line-clamp` for dense UI lists.

**Rule D12 — TYPOGRAPHY**: NEVER use generic fonts (Inter, Roboto, Arial, system-ui as primary). The three font families are fixed and intentional.

### 2.3 — Spacing & Radius

```css
--radius: 6px;       /* Default: cards, inputs, buttons */
--radius-lg: 10px;   /* Large: panels, KPI cards, tables */
--radius-xl: 14px;   /* Extra large: modals */
```

No arbitrary border-radius values. These three tokens are the only allowed values.

### 2.4 — Background Atmosphere

```css
body {
  background-image:
    radial-gradient(ellipse 800px 400px at 15% -5%, rgba(212, 169, 67, 0.06), transparent),
    radial-gradient(ellipse 600px 300px at 95% 100%, rgba(123, 163, 184, 0.04), transparent);
  background-attachment: fixed;
}
```

**Rule D13 — BACKGROUND**: This background atmosphere is intentional and required. It creates depth without distraction. Solid color backgrounds are only used for surfaces (cards, panels), not for the page body. This is the ONLY gradient in the application.

---

## 3. Animation & Motion *(from frontend-design, with baseline-ui + fixing-motion-performance guardrails)*

**Frontend-design philosophy**: Motion creates delight and memorability. One well-orchestrated page load with staggered reveals creates more impact than scattered micro-interactions. Use scroll-triggered reveals and hover states that surprise. Motion is part of our aesthetic identity — not an afterthought.

**Guardrail philosophy**: Frontend-design decides *what* animates and *why*. Baseline-ui and fixing-motion-performance constrain *how* — ensuring animations stay on the compositor, respect user preferences, and never cause jank.

### 3.1 — What CAN Animate

| Property | Allowed? | Constraint |
|---|---|---|
| `transform` (translate, scale, rotate) | ✅ YES | Primary animation mechanism |
| `opacity` | ✅ YES | Secondary mechanism |
| `background-color`, `border-color` | ⚠️ LIMITED | Only on small isolated elements (buttons, nav items, badges). Duration ≤ 150ms. |
| `color` | ⚠️ LIMITED | Text color transitions on hover only. Duration ≤ 150ms. |
| `width`, `height`, `top`, `left`, `margin`, `padding` | ❌ NEVER | Use transform instead. See FLIP pattern. |
| `filter: blur()` | ❌ NEVER | Except one-shot effects ≤ 8px, ≤ 200ms. Never continuous. |
| `box-shadow` | ❌ AVOID | Prefer opacity transitions on pseudo-elements. |

### 3.2 — Duration & Easing

| Context | Max Duration | Easing |
|---|---|---|
| Interaction feedback (hover, click, focus) | 150ms | `ease-out` |
| Micro-interactions (toggle, expand) | 200ms | `ease-out` |
| View transitions (page/drawer enter) | 300ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Status indicators (pulse) | 2500ms | `ease-in-out` |
| Loading (indeterminate shimmer) | Continuous | Linear |

**Rule M1 — DURATION**: Never exceed 200ms for interaction feedback (hover, click, focus, toggle). View transitions may use up to 300ms. Status indicators are exempt.

**Rule M2 — EASING**: Use `ease-out` for entrance animations. Never use custom cubic-bezier curves unless explicitly approved for a specific transition.

### 3.3 — Compositor-Only (Critical)

**Rule M3 — COMPOSITOR**: All animations MUST use only compositor properties (`transform`, `opacity`). Layout-triggering properties (`width`, `height`, `top`, `left`, `margin`, `padding`) are NEVER animated. Paint-triggering properties (`background`, `color`) are allowed only on small, isolated elements (≤ 200x200px).

**Rule M4 — LAYER PROMOTION**: Use `will-change: transform` or `will-change: opacity` temporarily and surgically — set it just before animation starts, remove it after animation ends. Never leave `will-change` permanently applied. Never apply `will-change` to large surfaces.

### 3.4 — Scroll & Visibility

**Rule M5 — SCROLL**: Never drive animation from `scrollTop`, `scrollY`, or scroll event listeners. Use `IntersectionObserver` for reveal-on-scroll. Use CSS Scroll Timelines when available.

**Rule M6 — OFF-SCREEN**: All looping animations MUST pause when the animated element is not visible (use `IntersectionObserver`).

**Rule M7 — REDUCED MOTION**: Respect `prefers-reduced-motion`. When the user has this preference, disable all non-essential animations. Essential animations: progress bars, loading indicators. Non-essential: hover transitions, entrance animations, pulse effects.

### 3.5 — Specific Animations

| Animation | Property | Duration | Notes |
|---|---|---|---|
| View fade-in | `opacity` + `transform: translateY(8px) → 0` | 300ms | Entrance only |
| Drawer slide-in | `transform: translateX(100%) → 0` | 300ms | Right panel |
| Button hover | `background-color` | 150ms | Small surface |
| Nav item hover | `background-color` + `color` | 150ms | Small surface |
| Card hover | `border-color` | 150ms | No transform |
| Status dot pulse | `opacity` | 2500ms | Looping, pauses off-screen |
| Progress bar fill | `transform: scaleX()` | 300ms | Determinate only |
| Progress indeterminate | `transform: translateX()` | 2000ms | Shimmer, loops, pauses off-screen |

**Rule M8 — NO EXCESS**: Do not add animation to elements not listed above unless explicitly approved. The animations listed here are the complete set of allowed animations.

### 3.6 — Performance Rules (from fixing-motion-performance)

**Rule M9 — NO LAYOUT THRASHING**: Never interleave DOM reads and writes in the same frame. Batch all reads before all writes. Use FLIP pattern for layout-like transitions: measure once, animate via transform.

**Rule M10 — NO rAF LOOPS**: Never use `requestAnimationFrame` loops without a stop condition. Infinite rAF loops are forbidden.

**Rule M11 — NEVER partially migrate animation APIs or mix animation systems within the same component.

---

## 4. Component Rules

### 4.1 — Accessibility Primitives

**Rule C1 — SEMANTIC HTML**: Always use native HTML elements over role-based hacks. `<button>` not `<div onclick>`. `<a>` not `<span onclick>`. `<input>` not `<div contenteditable>`. Lists use `<ul>`/`<ol>` with `<li>`. Tables use `<th>` for headers.

**Rule C2 — ACCESSIBLE NAMES**: Every interactive control must have an accessible name. Icon-only buttons MUST have `aria-label`. Every `<input>`, `<select>`, `<textarea>` MUST have an associated `<label>`. Links must have meaningful text — never "click here" or "view more."

**Rule C3 — ICONS**: All decorative icons MUST have `aria-hidden="true"`. Icon-only buttons MUST have `aria-label` describing the action. No icon-only button is allowed without a text alternative.

### 4.2 — Focus & Keyboard

**Rule C4 — FOCUS VISIBLE**: All interactive elements must have a visible focus indicator. Gold outline, 2px offset. Never remove focus outlines without providing a visible, high-contrast replacement.

**Rule C5 — TAB ORDER**: All interactive elements must be reachable via Tab. Tab order must follow visual order. `tabindex` must never exceed 0. Use `tabindex="0"` to add custom elements to the tab order; use `tabindex="-1"` to make elements programmatically focusable only.

**Rule C6 — KEYBOARD**: Escape must close drawers, modals, and overlays. Enter/Space must activate buttons and links. Arrow keys must navigate within composite components (sidebar nav, pipeline board, calendar).

**Rule C7 — FOCUS TRAP**: Modals and drawers must trap focus while open. Focus must be restored to the trigger element on close. Initial focus must be set to the first focusable element inside the modal/drawer.

**Rule C8 — SKIP LINK**: A skip-to-content link must be the first focusable element on every page. It must move focus to `<main id="main-content">` when activated.

### 4.3 — Target Sizes

**Rule C9 — TARGET SIZE**: All interactive elements must have a minimum target size of 24×24 CSS pixels (WCAG 2.2 SC 2.5.8). This includes buttons, nav items, filter pills, checkboxes, and clickable rows.

### 4.4 — Forms & Errors

**Rule C10 — FORM LABELS**: Every form field must have a visible `<label>` associated via `htmlFor`/`id`. Placeholder text is never a substitute for a label.

**Rule C11 — ERROR DISPLAY**: Errors must be shown next to the field that caused them. Use `aria-describedby` to link error messages to inputs. Set `aria-invalid="true"` on invalid fields. Required fields must be announced as required.

**Rule C12 — ERROR MESSAGES**: Error messages must describe the problem and suggest a fix. Never show "Invalid input" without explaining what's invalid and how to fix it.

**Rule C13 — NO PASTE BLOCKING**: Never block paste in `<input>` or `<textarea>` elements. The operator may need to paste grant text, URLs, or budget data.

### 4.5 — Destructive Actions

**Rule C14 — CONFIRMATION**: Destructive or irreversible actions (delete grant, remove source, discard draft, restore from backup) must use a confirmation dialog. The dialog must describe the consequence and require explicit confirmation. Two-step actions: the user must click the action, then confirm in the dialog.

### 4.6 — Loading States

**Rule C15 — SKELETONS**: Use structural skeletons for loading states on cards, tables, and panels. A skeleton is a low-contrast placeholder shape matching the loaded content's layout. Do not use spinners for content areas — spinners are for operations, skeletons are for loading data.

**Rule C16 — PROGRESS**: All async operations must show a progress bar with stage label. Determinate when progress is known, indeterminate otherwise. Both must have `role="progressbar"`, `aria-valuenow` (or omitted for indeterminate), `aria-valuemin`, `aria-valuemax`, and `aria-label`.

### 4.7 — Empty States

**Rule C17 — EMPTY**: Every empty state must have exactly one clear next action — a primary button that moves the operator forward. Empty states show: an icon, a title describing what's missing, a one-sentence explanation, and a single CTA button. No empty state is allowed without a next action.

### 4.8 — Live Regions

**Rule C18 — ANNOUNCEMENTS**: Dynamic content changes (job completion, notification arrival, crawl finish, error state change) must use `aria-live` regions. Critical errors use `aria-live="assertive"`. Status updates use `aria-live="polite"`. Loading states use `aria-busy="true"`.

---

## 5. Interaction Rules

### 5.1 — Hover & Focus Parity

**Rule I1 — NO HOVER-ONLY**: Any interaction available on hover must also be available via keyboard. Hover-only interactions are forbidden. If a tooltip appears on hover, it must also appear on focus.

### 5.2 — State Indication

**Rule I2 — NOT COLOR ALONE**: Disabled, error, success, and warning states must not rely on color alone. Use icons, text labels, or patterns in addition to color. A red border alone does not indicate an error — it must be accompanied by an error icon and message.

### 5.3 — Safe Area

**Rule I3 — SAFE AREA**: Fixed-position elements (drawers, modals, floating action bars) must respect `safe-area-inset` on devices with notches or rounded corners.

### 5.4 — Height

**Rule I4 — HEIGHT**: Never use `height: 100vh` for full-height elements. Use `height: 100dvh` (dynamic viewport height) to account for mobile browser UI.

---

## 6. Contrast Requirements

### 6.1 — Text Contrast

| Text Type | Minimum Ratio | Our Values |
|---|---|---|
| Normal text (< 18px) | 4.5:1 | `--text` (#ebe6dc) on `--bg` (#1c1a17) = **10.2:1** ✅ |
| Large text (≥ 18px or bold ≥ 14px) | 3:1 | Same as above ✅ |
| UI components, icons | 3:1 | Checked per component |
| Muted/disabled text | No minimum (must not convey essential info) | `--text-muted` (#807a6d) = **3.9:1** ⚠️ — only for non-essential labels |

**Rule CR1 — CONTRAST**: All text conveying essential information must meet WCAG AA contrast ratios. Muted text (#807a6d) may only be used for supplementary, non-essential information (timestamps, secondary labels, "no items" messages when icon is present).

### 6.2 — Focus Indicator Contrast

**Rule CR2 — FOCUS CONTRAST**: Focus indicators must have at least 3:1 contrast against adjacent colors. Our gold focus ring (#d4a943) against dark background (#1c1a17) = **6.1:1** ✅.

---

## 7. Layout & Z-Index

### 7.1 — Z-Index Scale

**Rule L1 — Z-INDEX**: Use this fixed z-index scale. No arbitrary values.

| Layer | z-index | Usage |
|---|---|---|
| Content | 0 | Default stacking |
| Dropdown, tooltip | 50 | Floating UI |
| Sticky header | 100 | Sticky elements |
| Drawer overlay | 200 | Modal backdrop |
| Drawer, modal | 300 | Drawer and modal panels |
| Skip-to-content | 400 | Must be above everything |
| Toast, notification | 500 | Temporary overlays |

---

## 8. Design Rules Summary (Quick Reference)

### NEVER (Hard Blocks)
- ❌ Inter, Roboto, Arial, Space Grotesk fonts
- ❌ Purple or multicolor gradients
- ❌ Glow effects as primary affordances
- ❌ `letter-spacing` modifications
- ❌ `width`/`height`/`top`/`left` animation
- ❌ `scrollTop`/`scrollY` for animation
- ❌ `rAF` loops without stop condition
- ❌ `will-change` left permanently applied
- ❌ `blur()` animation except one-shot ≤ 8px
- ❌ `tabindex > 0`
- ❌ `<div>` as button without full keyboard support
- ❌ Color-only state indication
- ❌ Hover-only interactions
- ❌ `height: 100vh`
- ❌ Blocked paste in inputs
- ❌ Removed focus outlines without replacement
- ❌ Placeholder as label substitute
- ❌ "Click here" link text
- ❌ Icon-only buttons without `aria-label`
- ❌ Spinners for content loading areas
- ❌ Empty states without a next action

### ALWAYS (Hard Requirements)
- ✅ Fraunces / Funnel Sans / JetBrains Mono only
- ✅ Gold as sole accent color per view
- ✅ Background atmosphere gradients on body
- ✅ `text-balance` on headings
- ✅ `text-pretty` on body
- ✅ `tabular-nums` on data
- ✅ `transform` + `opacity` for animation
- ✅ `ease-out` for entrance
- ✅ ≤ 200ms for interaction feedback
- ✅ `prefers-reduced-motion` respected
- ✅ Animations paused off-screen
- ✅ 24×24px minimum target size
- ✅ Visible focus indicators
- ✅ `aria-label` on icon-only buttons
- ✅ `<label>` on every input
- ✅ `aria-describedby` for errors
- ✅ `aria-invalid` on invalid fields
- ✅ `aria-live` for dynamic updates
- ✅ Escape closes dialogs
- ✅ Focus trapped in modals
- ✅ Focus restored on close
- ✅ `role="progressbar"` on progress bars
- ✅ `safe-area-inset` respected
- ✅ Confirmation for destructive actions
- ✅ One clear next action in empty states
- ✅ Structural skeletons for loading
- ✅ Batch DOM reads before writes
