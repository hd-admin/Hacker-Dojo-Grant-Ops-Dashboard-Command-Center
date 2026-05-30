# 02 — Discovery & Prospecting

## Overview

The Discovery module finds and ranks grant opportunities for Hacker Dojo. It combines automated crawling of configured sources with AI-powered intelligent matching — running entirely locally via OpenCode.

## Key Features

### 1. Smart Search
Natural-language interface to find grants. The operator describes what they're looking for in plain language ("makerspace equipment grants in the Bay Area, $50K–$500K") and OpenCode searches configured sources plus the built-in funder database.

### 2. Built-in Funder Database
Curated, hardcoded starter set of funders relevant to Hacker Dojo, plus crawled additions from operator-added sources. Pre-loaded with NSF, Google.org, Knight Foundation, Sloan, Schmidt Futures, and ProPublica nonprofit data. Everything stored locally in SQLite — no cloud dependency.

### 3. Peer Discovery
OpenCode analyzes similar maker spaces, hackerspaces, and community innovation hubs to surface funders that support comparable organizations. "Organizations like Hacker Dojo also received funding from..."

### 4. Smart Matching Engine
Five-dimension fit scoring (mission alignment, geographic focus, program track record, budget capacity, partnership readiness) with:
- AI-powered eligibility checking against funder requirements
- Historical award-size analysis from funder giving patterns
- Deadline urgency factoring
- Configurable auto-draft threshold (default: fit ≥ 75)

### 5. Saved Searches & Auto-Updates
Saved search queries that automatically refresh with each crawl cycle. New opportunities matching saved criteria surface automatically. "3 new grants matched your 'AI literacy programs' search this week."

### 6. Advanced Funder Insights
Beyond basic funder profiles: multi-year giving trends, typical award sizes, funding priorities by year, organizations commonly funded together. "This foundation has increased STEM funding 40% year-over-year."

### 7. Eligibility Vetting
Before the operator spends time on a grant, the AI checks basic eligibility: nonprofit status, geography, budget range, program area fit. Clearly flags: "You meet all eligibility requirements" or "Requires 3 years of audited financials — Hacker Dojo has 2 years on file."

### 8. Hidden Giving Pattern Detection
OpenCode analyzes funder 990 data to detect patterns a human might miss: funders that consistently support makerspaces but don't advertise it, foundations shifting focus areas, new corporate giving programs without formal RFPs yet.

### 9. Auto-Updating Grant Pipeline
Newly crawled grants are automatically matched, scored, and added to the discovery queue. The operator opens the app and sees what's new since last session — no manual refresh required (though manual refresh is available).

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  DISCOVERY VIEW                                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🔍 "Find grants for AI literacy programs in the Bay │    │
│  │     Area, equipment-focused, $50K-$500K range"       │    │
│  │                                          [Search]   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Quick Filters:  [All] [Federal] [Foundation] [Corporate]   │
│                  [Community] [State] [Corporate]             │
│  Sort: [Best fit ▼]  [☐ Only exact deadlines]              │
│                                                             │
│  Saved Searches:  "AI Literacy" (3 new) · "Equipment" (1)   │
│                                                             │
│  ┌──────┬──────────┬──────────┬──────────┬──────────┐      │
│  │ Grant│ Funder   │ Award    │ Deadline │ Fit      │      │
│  ├──────┼──────────┼──────────┼──────────┼──────────┤      │
│  │ ...  │ NSF      │ $1.5-3M  │ Jun 16   │ 92 ████░ │      │
│  │ ...  │ Google   │ $250-500K│ Jul 9    │ 88 ████  │      │
│  │ ...  │ Sloan    │ $50-250K │ Jul 31   │ 84 ████  │      │
│  └──────┴──────────┴──────────┴──────────┴──────────┘      │
│                                                             │
│  Sources: 12 configured · 8 crawled · Last crawl: 2h ago    │
│  [+ Add Source]  [+ Add Grant Manually]  [Export CSV]       │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

```typescript
interface FunderProfile {
  id: string;
  name: string;
  type: "foundation" | "government" | "corporate" | "community" | "other";
  ein?: string;
  givingHistory: {
    year: number;
    totalGiving: number;
    grantsCount: number;
    averageGrantSize: number;
  }[];
  focusAreas: string[];
  geographicFocus: string[];
  typicalAwardRange: { min: number; max: number };
  applicationProcess: string;
  deadlines: string;
  sourceUrls: string[];
  lastUpdated: string;
}

interface SavedSearch {
  id: string;
  name: string;
  queryText: string;
  filters: {
    categories?: string[];
    funderTypes?: string[];
    minAward?: number;
    maxAward?: number;
    geography?: string;
  };
  newResultsCount: number;
  lastCheckedAt: string;
  createdAt: string;
}
```

## Crawl Architecture

See [09-technical-architecture.md](./09-technical-architecture.md) for the agent loop. Crawls use the typed-artifact pattern: OpenCode writes `tmp/crawl-{runId}.json`, app validates against Zod schema, ingests into SQLite, retries up to 3 times on failure.

## Scheduler

```typescript
const DEFAULT_SCHEDULES = {
  "grants.gov": { intervalHours: 24 },
  "nsf.gov": { intervalHours: 48 },
  "google.org": { intervalHours: 168 },
  "knightfoundation.org": { intervalHours: 168 },
  "sloan.org": { intervalHours: 168 },
  "schmidtfutures.com": { intervalHours: 168 },
  "propublica.org": { intervalHours: 24 },
};
```

## Scope Boundaries

- Curated funder database built locally from crawling, not a cloud-synced massive catalog
- Single-operator discovery — no team sharing features
- Data quality improves over time as crawls accumulate and operator adds sources
