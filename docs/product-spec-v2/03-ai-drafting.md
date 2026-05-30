# 03 — AI Drafting & Apply

## Overview

The drafting module helps write grant proposals faster by reusing institutional knowledge, adapting past language, and grounding every claim in Hacker Dojo's real documents and data.

## Key Features

### 1. Smart Recommendations
During drafting, the AI surfaces context-aware suggestions:
- "This funder typically awards $X–Y to organizations of your size"
- "They prioritize [focus area] — emphasize your [related program]"
- "Your Impact Report shows [stat] — include this here"
- Funder-specific tips based on past giving patterns

### 2. Institutional Memory
Every approved draft's sections are indexed as reusable snippets. When drafting a new application, relevant past sections are suggested. The operator can browse all past snippets by topic, funder, or program area and insert with one click — adapted to the current grant's context.

### 3. Grounded Drafting (ENHANCED)
**Current**: Drafts reference org documents
**Enhanced**: 
- Section-level grounding: each section shows which documents support it
- Color-coded grounding confidence: green (strong), yellow (weak), red (unsupported)
- One-click "show evidence" for any claim
- Grounding gaps block approval

### 4. Draft Versioning & Revision Loop
- Each draft has versions: v1 (initial), v2 (after revision), v3, etc.
- Revision instructions are stored: "Reduce jargon, emphasize community outcomes"
- Agent regenerates specific sections, not the whole draft
- Side-by-side diff view between versions

### 5. In-App Application Forms
For funders with structured forms, the system generates form-ready responses mapped to each field. The operator sees the funder's questions alongside AI-suggested answers — drawn from past proposals, org documents, and funder research. Forms for known funders are pre-built; new forms can be added by the operator.

### 6. Full Control Over AI Voice & Style
The operator controls exactly what powers the AI output:
- Configurable voice and tone rules ("plain-spoken, evidence-led, builder-community framing")
- Content sources: choose which documents and past proposals the AI draws from
- Style preferences: character count limits, section structure preferences
- The AI never trains on Hacker Dojo's data externally

### 7. Application Tracking
Each application moves through clear stages: draft → review → approved → submitted. The operator always knows which version is the approved one, what feedback was given, and what still needs attention before submission.

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  GRANT DETAIL — NSF TechAccess                               │
│                                                             │
│  ┌─ Smart Tips ────────────────────────────────────────┐   │
│  │ 💡 NSF awarded $2.1M avg to similar orgs in 2025      │   │
│  │ 💡 They value "equitable access" — see your Impact    │   │
│  │    Report section 3 for relevant stats                │   │
│  │ 💡 Include your partnership with Mountain View Library │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Draft v2 · AI-generated · 2,847 words ─────────────┐   │
│  │                                                       │   │
│  │  1. Project Vision                                    │   │
│  │  ┌──────────────────────────────────────────────┐     │   │
│  │  │ Hacker Dojo proposes to anchor the Silicon   │     │   │
│  │  │ Valley AI-Ready Hub...                        │     │   │
│  │  │ ▸ Grounded in: 2025 Impact Report, NSF RFP   │     │   │
│  │  └──────────────────────────────────────────────┘     │   │
│  │                                                       │   │
│  │  2. Why Hacker Dojo                                    │   │
│  │  ┌──────────────────────────────────────────────┐     │   │
│  │  │ For 16 years, Hacker Dojo has operated as... │     │   │
│  │  │ ▸ Grounded in: One-Pager v3, Board Bios      │     │   │
│  │  └──────────────────────────────────────────────┘     │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Suggested Snippets ──────────────────────────────┐   │
│  │ 📋 "AI Literacy Program" — from Google.org draft    │   │
│  │ 📋 "Community Impact Stats" — from Knight draft     │   │
│  │ 📋 "Partnership Description" — from NSF LOI v1      │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ In-App Form ──────────────────────────────────────┐   │
│  │ Q: "Describe your organization's mission"           │   │
│  │ A: [AI-suggested] Hacker Dojo is a community-      │   │
│  │    driven makerspace...                             │   │
│  │                                                     │   │
│  │ Q: "Project budget and justification"               │   │
│  │ A: [AI-suggested from uploaded budget doc] ...      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Request Revision] [Approve & Lock] [Edit Directly]        │
└─────────────────────────────────────────────────────────────┘
```

## Snippet System

```typescript
interface DraftSnippet {
  id: string;
  sectionTitle: string;
  content: string;
  sourceGrantId: string;
  sourceFunder: string;
  topicTags: string[];
  programArea?: string;
  usedCount: number;
  lastUsedAt?: string;
  createdAt: string;
}

// Indexed by: section title, topic, funder, program area
// Searchable from within the draft editor
// Insert with one click — adapts to current grant context
```

## Agent Loop for Drafting

See [09-technical-architecture.md](./09-technical-architecture.md) for the full agent loop pattern.

Drafting follows the same typed-artifact contract:
1. App builds prompt with: grant details, org profile, relevant documents, past snippets, revision instructions
2. OpenCode writes `tmp/draft-{jobId}-{version}.json`
3. App typechecks against DraftArtifactSchema
4. On validation failure: agent retries with specific schema error feedback
5. On success: artifact persisted, draft rendered in UI

## Grounding Review

Before a draft can be approved, the user must review grounding:

| Section | Grounding Status | Evidence |
|---|---|---|
| Project Vision | ✅ Strong | Impact Report (p3-5), NSF RFP (section 2) |
| Why Hacker Dojo | ✅ Strong | One-Pager v3, Board Bios, Member Survey 2025 |
| Hub Activities | ⚠️ Weak | Only NSF RFP references — needs program logic model |
| Partners | ❌ Missing | No partnership letters uploaded |

Grounding review is a hard gate before approval. The "Approve & Lock" button is disabled until all sections are at least "weak" (yellow) and the user acknowledges any gaps.

## Scope Boundaries

- Generates proposal content, not interactive web forms
- Funder insights derived from crawled data + OpenCode analysis, not a centralized 990 database
- Single-operator review and approval — no collaborative editing
