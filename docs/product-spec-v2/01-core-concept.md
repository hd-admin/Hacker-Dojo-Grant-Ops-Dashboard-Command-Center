# 01 — Core Concept & Hardcoded Profile

## Product Vision

**Hacker Dojo Grant Ops is the local-first, AI-powered grant operating system for Hacker Dojo.** It covers the full grant lifecycle — from discovering opportunities through post-award compliance — without requiring cloud services, subscriptions, or manual setup.

## Core Principles (v2)

1. **Hardcoded for Hacker Dojo** — No setup wizard. Org profile, programs, voice pre-loaded.
2. **Full Lifecycle** — Discover → Draft → Submit → Track → Report. Nothing falls through cracks.
3. **AI-First, Human-Approved** — AI assists at every stage; humans approve every submission.
4. **Local-First, Zero Cloud for Persistence** — All application data stays on disk. Backups are folder copies. No hosted database, SaaS backend, or cloud storage dependency. Optional AI features and operator-enabled external data APIs may require internet access, but the app remains fully usable for manual grant tracking when offline.
5. **Opinionated for Makerspaces** — Categories, tags, and funder knowledge tuned for community spaces.

## Hardcoded Hacker Dojo Profile

The following is baked into the application — no user input required:

```yaml
# Source: https://hackerdojo.org/ — verified May 2026
organization:
  legalName: "Hacker Dojo, a California nonprofit corporation"
  ein: "26-4812213"                    # Verified from hackerdojo.org footer
  nonprofitStatus: "501(c)(3)"         # Verified from hackerdojo.org footer
  yearFounded: 2009                    # 17 years as of 2026
  samUEI: ""                           # TODO: verify with ED
  contactInfo:
    phone: "(650) 429-8605"           # From hackerdojo.org footer
    website: "https://hackerdojo.org"  # NOT .com
    address: "855 Maude Ave, Mountain View, CA 94043"
  geography: "San Francisco Bay Area / Silicon Valley"
  mission: >
    Hacker Dojo is a collaborative hackerspace where tech enthusiasts 
    gather to build, experiment, and improve. A community-driven 
    makerspace and coworking hub in Mountain View, California, 
    providing equitable access to tools, mentorship, and collaborative 
    learning for hackers, makers, builders, and lifelong learners.

programAreas:
  - "Makerspace operations (hardware labs, 3D printing, maker tools)"
  - "AI literacy and emerging technology education"
  - "AI Career Initiative (career pivot and upskilling program)"
  - "AI Stars program"
  - "Startup Accelerator"
  - "Summer Camp (youth STEM education)"
  - "Community innovation and entrepreneurship"
  - "Workforce development and STEM equity"
  - "Informal STEM learning"
  - "Digital inclusion and technology access"
  - "Hackathons and technical workshops"
  - "Hack Comedy Night and community events"

populationsServed:
  - "First-generation learners and career-changers"
  - "Women and underrepresented groups in tech"
  - "Returning workers and career-transitioners"
  - "Non-native English speakers"
  - "Bay Area residents"
  - "Students and lifelong learners"
  - "Startup founders and entrepreneurs"
  - "Veterans (dedicated membership tier)"

partnerships:
  - "Mountain View Public Library"
  - "Foothill-De Anza Community College District"
  - "Code2College"
  - "Local makerspaces and hackerspaces"
  - "Meetup.com (events platform)"
  - "Every.org (donation processing)"

fundingHistory:
  - year: 2025
    source: "Community memberships (~$150/mo standard)"
    purpose: "Operational funding"
  - year: 2025
    source: "Corporate and individual donations"
    purpose: "Expansion and equipment"

complianceFacts:
  - "501(c)(3) verified — IRS confirmation on file (EIN 26-4812213)"
  - "California Secretary of State — active nonprofit"
  - "Founded 2009 — 17-year track record"
  - "Policies published at wiki.hackerdojo.com"

searchThemes:
  - "Makerspaces and hackerspaces"
  - "AI literacy and trustworthy AI"
  - "Community innovation hubs"
  - "Workforce development"
  - "STEM equity and informal STEM"
  - "Digital inclusion"
  - "Bay Area / Silicon Valley"
  - "Equipment and capital investment"
  - "Capacity building for nonprofits"
  - "Youth STEM education and summer camps"
  - "Startup accelerators and entrepreneurship"
  - "Veteran career transition programs"

boardMembers:
  - name: "Emily Johnson"
    role: "Board Member"
  - name: "Marco Palacios"
    role: "Board Member"
  - name: "Eva Carrender"
    role: "Board Member"
  - name: "Peter Theobald"
    role: "Board Member"
  - name: "David Weekly"
    role: "Board Advisor"
  - name: "Mark Stofer"
    role: "Board Advisor"

agentBehavior:
  autoDraftThreshold: 75
  submissionPolicy: "Human approval required — agent never submits"
  notifyEmail: "ed@hackerdojo.com"     # Use real ED email
  voiceAndTone: >
    Plain-spoken, evidence-led, builder-community framing.
    Avoid jargon. Lead with outcomes. Reference Hacker Dojo's
    17-year track record (founded 2009), 4,200+ members, 
    380+ annual events, hardware labs, and impact metrics 
    from the Impact Report.
```

## Pre-Configured Default Sources

These funding sources ship with the app (no user configuration needed):

| Source | Type | Category |
|---|---|---|
| grants.gov | API/website | Federal |
| NSF (nsf.gov) | Website | Federal |
| Google.org | Website | Corporate |
| Knight Foundation | Website | Foundation |
| Sloan Foundation | Website | Foundation |
| Schmidt Futures | Website | Foundation |
| ProPublica Nonprofit API | API | Data |
| California Grants Portal | Website | State |

## Architecture Decisions (v2)

### ADR-001: Hardcoded Profile Over Setup Wizard
**Decision**: Ship with Hacker Dojo's profile baked in. Remove the 3-step setup wizard.
**Rationale**: The app is purpose-built for one organization. Setup wizards add friction. If another org wants to use it, they can fork and modify the hardcoded profile.
**Trade-off**: Less flexible, but dramatically simpler for the primary user.

### ADR-002: Full Lifecycle Over Discovery-Only
**Decision**: Expand scope to include post-award management (spend-down tracking, compliance, reporting).
**Rationale**: Discovery without post-award means the operator switches tools mid-workflow — spreadsheets for tracking, calendar for deadlines, email for follow-ups. Full lifecycle keeps everything in one place.
**Trade-off**: Larger scope, but each stage feeds the next with shared data.

### ADR-003: AI Features as First-Class, Not Add-On
**Decision**: AI (via OpenCode CLI) is woven into every stage — discovery, drafting, award extraction — not just drafting.
**Rationale**: AI is most valuable when integrated into workflow (smart matching, auto-extracting deadlines from award letters, suggesting past language), not as a separate "generate" button.
**Trade-off**: More complex AI orchestration, but dramatically better UX.

### ADR-004: Local SQLite + File Storage
**Decision**: Continue with SQLite for structured data, filesystem for documents.
**Rationale**: Proven in v1. No migration needed. Simple backup.
**Trade-off**: No multi-user, but v2 remains single-user.

## The Only User-Configurable Field

The app is an internal tool for Hacker Dojo. Everything about the organization is hardcoded. The **only** field the operator needs to set is their **name** — used when drafting emails, signing grant cover letters, and recording submission actions.

```yaml
operator:
  name: ""  # Set once, used for all outgoing communication
  # Everything else is derived from the hardcoded profile:
  # - Organization name, EIN, address, mission
  # - Program areas, populations served, partnerships
  # - Agent voice/tone, auto-draft thresholds
  # - Default funding sources and crawl schedules
```

The name is stored in the SQLite `settings` table under `operator.name` and read on startup. If not set, the app prompts once: "What's your name? This will be used when drafting emails and recording submissions." This is the only onboarding prompt.

## User Model

- **Single internal operator** for Hacker Dojo grant operations
- Acts in multiple capacities: executive reviewer, grant researcher, program contributor, budget coordinator
- Responsibility tags (finance, program, review, follow-up) are workflow categories for a single person, not multi-user roles
- **No user accounts, no login, no multi-user** — this is an internal desktop app

## Engineering Principles

### No Backward Compatibility

This is an internal app. There is no "v1 user base" to maintain compatibility with. When a better approach exists, **aggressively replace the old one**. Schema migrations should transform data forward; old schemas are not preserved. API routes that are no longer needed should be deleted, not deprecated.

### Aggressive Dead Code Removal

Dead code is a liability. It confuses future work, bloats the codebase, and wastes time during debugging. The following MUST be removed on sight:

- Unused imports
- Unused components and their test files
- Unused API routes
- Unused utility functions
- Unused types and schemas
- Commented-out code
- CSS classes with no matching HTML
- Configuration for removed features
- Test fixtures for deleted components
- "TODO" comments that will never be done

**Rule**: If `pnpm typecheck && pnpm lint && pnpm test` passes without it, it can be deleted. Run `npx knip` (or equivalent dead code detection) before every significant commit.

## What's Removed in v2

1. **3-step setup wizard** — replaced by hardcoded profile + single name prompt
2. **First-run guidance cards** — replaced by contextual empty states
3. **OpenCode path configuration UI** — auto-detected from PATH; if missing, shows degraded banner
4. **Organization profile editing UI** — pre-populated, still editable via config file if ever needed
5. **All multi-user scaffolding** — roles, permissions, team invites, collaborator management
6. **All dead code from v1 that doesn't serve v2 features**
