# Hacker Dojo Grant Ops — Product Specification v2

> **Last updated**: May 30, 2026
> **Status**: Draft v2

## Purpose

This specification defines the next evolution of Hacker Dojo Grant Ops — a local-first, full-lifecycle grant management application purpose-built for Hacker Dojo. It preserves our core advantages (local-first, zero cloud dependency, hardcoded org knowledge) while expanding into post-award management, smarter AI features, and a polished, cohesive UI.

## Key Shift from v1

| Aspect | V1 (Current) | V2 (Target) |
|---|---|---|
| Setup | Guided 3-step wizard | Hacker Dojo profile hardcoded; no setup needed |
| Scope | Discovery + Pipeline | Full lifecycle: Discovery → Draft → Submit → Post-Award |
| AI | OpenCode CLI backend | Typed artifact agent loop with retry, verification, progress feedback |
| Funder Data | Crawled from user sources | Built-in curated funder database + crawler |
| Post-Award | Not present | Spend-down tracking, compliance, reporting |
| Design | Dark theme, utilitarian | Refined dark theme with cohesive design system |
| Async UX | No progress indicators | Full progress bars, stage indicators, cancel/retry for all AI operations |

## Document Index

| # | Document | Content |
|---|---|---|
| 00 | [Competitive Context](./00-competitive-analysis.md) | Market landscape, our positioning, design direction |
| 01 | [Core Concept](./01-core-concept.md) | Product vision, hardcoded Hacker Dojo profile, architecture decisions |
| 02 | [Discovery & Prospecting](./02-discovery-prospecting.md) | Smart matching, funder database, peer discovery |
| 03 | [AI Drafting](./03-ai-drafting.md) | Grounded drafting, institutional memory, revision workflow |
| 04 | [Pipeline & Workflow](./04-pipeline-management.md) | Full pipeline states, task management, submission readiness |
| 05 | [Post-Award Management](./05-post-award.md) | Award tracking, spend-down, compliance, reporting |
| 06 | [Dashboard & Reporting](./06-dashboard-reporting.md) | KPI dashboard, internal reports, activity feed |
| 07 | [Wireframes](./07-wireframes.md) | ASCII wireframes for all key screens |
| 08 | [Design System](./08-design-system.md) | Color palette, typography, components |
| 09 | [Technical Architecture](./09-technical-architecture.md) | Agent loop, typed artifacts, tmp management, async UI |
| 10 | [Technical Acceptance Criteria](./10-technical-acceptance-criteria.md) | **Specific, testable AC for every subsystem** |
| 11 | [Technical Infrastructure](./11-technical-infrastructure.md) | Technology stack, API routes, document management, search, notifications, configuration, passcode, logging, backup, identity |
| 12 | [Data Architecture](./12-data-architecture.md) | Connection configuration, complete database schema (all tables, indexes, FTS5), seed data, initialization, SQLite gotchas |

## How to Use This Spec

1. **Start with [00-competitive-analysis.md](./00-competitive-analysis.md)** to understand the competitive landscape
2. **Read [01-core-concept.md](./01-core-concept.md)** for the product vision and principles
3. **Jump to any feature doc** for detailed specifications of that area
4. **Reference [07-wireframes.md](./07-wireframes.md)** for visual layout of key screens
5. **Use [08-design-system.md](./08-design-system.md)** for implementation design tokens

## Relationship to Existing Docs

- `PROMPT.md` — still authoritative for implementation scope
- `docs/grant-ops-expanded-acceptance-criteria.md` — still authoritative for acceptance criteria
- This spec defines the *what and why*; acceptance criteria define the *verification*
