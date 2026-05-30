# 08 — Design System

## Design Tokens

### Colors

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

  /* Accent — gold, like warm lighting */
  --accent: #d4a943;
  --accent-dim: #8a6f2d;

  /* Semantic */
  --success: #8aab6f;
  --warning: #e0894a;
  --danger: #c66b5a;
  --info: #7ba3b8;
}
```

### Typography

| Token | Font Stack | Usage |
|---|---|---|
| `--serif` | `'Fraunces', Georgia, serif` | Page titles, KPI values, drawer titles |
| `--sans` | `'Funnel Sans', system-ui, sans-serif` | Body text, buttons, labels, UI controls |
| `--mono` | `'JetBrains Mono', ui-monospace, monospace` | Labels, funder names, codes, metadata, stats |

**Type Scale**:
- Headings: 38px (page title), 26px (drawer title), 22px (brand mark), 17px (panel title)
- Body: 14px (default), 13.5px (nav items), 13px (table content)
- Small: 12px (meta), 11px (sub headers), 10px (labels, badges), 9px (tags)

### Spacing & Radius

```css
--radius: 6px;       /* Default: cards, inputs, buttons */
--radius-lg: 10px;   /* Large: panels, KPI cards, tables */
--radius-xl: 14px;   /* Extra large: modals */
```

### Background Effect

```css
body {
  background-image:
    radial-gradient(ellipse 800px 400px at 15% -5%, rgba(212, 169, 67, 0.06), transparent),
    radial-gradient(ellipse 600px 300px at 95% 100%, rgba(123, 163, 184, 0.04), transparent);
  background-attachment: fixed;
}
```

## Layout System

### App Shell
```
┌──────────┬──────────────────────────────────────────┐
│ SIDEBAR  │  MAIN CONTENT                            │
│ 220px    │  flex 1, max 1400px                      │
│ sticky   │  padding: 32px 40px 60px                 │
│ 100vh    │                                          │
└──────────┴──────────────────────────────────────────┘
```

### Sidebar Sections
- **Brand** (bottom border) — logo + version
- **Workspace nav** — Dashboard, Discovery, Pipeline, Sources, Settings
- **Activity nav** — Notifications, Tasks, Jobs, Audit, Duplicates
- **Footer** — crawler status, last sync, operator email

### Views
Views use display:none/block switching with fade-in animation. Only the active view renders.

## Component Patterns

### Buttons
- **Primary**: gold background (`var(--accent)`), dark text, bold
- **Secondary/Ghost**: transparent or surface background, border
- **Small**: reduced padding for inline/toolbar use
- **Pill filters**: monospace, rounded, active state with gold highlight

### Cards (KPI)
- Surface background, border, left accent bar (color varies by semantic meaning)
- Label: mono uppercase, muted. Value: serif, large.
- Semantic variants: default (gold bar), success (green), warning (orange), info (blue)

### Panels
- Surface background, border, rounded corners
- Header with serif title + mono action link
- Content: deadline items, activity items, board columns

### Data Tables (Discovery)
- Header row: mono uppercase, muted, non-interactive
- Data rows: hover highlight, clickable
- Columns: title, funder, award, deadline, fit score
- Fit score: numeric + color bar (green ≥ 85, amber 70-84, muted < 70)

### Pipeline Board
- Horizontal scroll columns, 5 visible
- Column header: mono uppercase + count badge
- Cards: elevated surface, funder mono label, grant title, deadline + award footer

### Grant Drawer
- Fixed right panel, 640px, slide-in animation
- Sticky header with funder label, title, meta grid
- Scrollable body: fit breakdown bars, checklist, draft preview, actions

### Progress Bars
- Determinate: filled portion with gold background
- Indeterminate: animated shimmer
- Both with `role="progressbar"` and aria attributes

## Interaction Patterns

### Focus & Keyboard
- Visible focus rings on all interactive elements (gold outline, 2px offset)
- Skip-to-content link (first focusable element)
- Escape closes drawers and modals
- Drawer traps focus when open

### Animations
- View transitions: fade + slight slide up (300ms)
- Drawer: slide in from right (300ms cubic-bezier)
- Hover: subtle background/border transitions (150ms)
- Status dot: pulse animation (2.5s)

### States
- **Empty**: centered icon + title + description + action buttons
- **Loading**: centered spinner with `aria-busy="true"`
- **Error**: banner with icon + message + retry/action button
- **Degraded**: yellow banner explaining what's unavailable
- **Offline**: red banner with recovery instructions

### Notifications
- Urgency: info (muted), warning (orange), urgent (red)
- Display: activity feed items with dot + text + timestamp
- Badges: count badges in sidebar nav items

## Design Principles

1. **Dark and warm** — like a makerspace at night, not a corporate dashboard
2. **Typography-led** — serif for presence, mono for precision, sans for readability
3. **Information hierarchy** — most important things largest and top-left
4. **Progressive disclosure** — powerful but not overwhelming
5. **Purposeful animation** — subtle, fast, never distracting
6. **Every state designed** — empty, loading, error, degraded all intentional
