# 06 — Dashboard & Reporting

## Overview

The Dashboard is the first thing the user sees. It must immediately communicate pipeline health, upcoming deadlines, system status, and what needs attention — without requiring exploration.

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Good afternoon, Ed.                                         │
│  Thursday · May 21 · 9 grants in pipeline                    │
│                                              [↻ Refresh]     │
│                                              [+ New Search]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Pipeline │ │ Deadline │ │  Drafted │ │  New     │      │
│  │  $4.85M  │ │   26d    │ │    3     │ │ Matches  │      │
│  │ 9 active │ │ NSF Jun16│ │  review  │ │  6 (7d)  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  ┌─────────────────────┐ ┌─────────────────────────────┐   │
│  │ Upcoming Deadlines   │ │ Agent Activity               │   │
│  │                      │ │                              │   │
│  │ 16 Jun · NSF $1.5M  │ │ ● Draft completed: NSF Tech  │   │
│  │ 09 Jul · Google $500K│ │ ● New match: Sloan $250K     │   │
│  │ 31 Jul · Sloan $250K │ │ ● Crawl succeeded: 12 srcs  │   │
│  │ View all →           │ │ ● Task completed: Budget     │   │
│  └─────────────────────┘ └─────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ System Status                                        │   │
│  │ 🟢 Crawler online · Last crawl: 2h ago               │   │
│  │ 🟢 OpenCode connected · v2.1.0                       │   │
│  │ 🟢 Storage healthy · 1.2GB free                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────┐ ┌─────────────────────────────┐   │
│  │ Awaiting Review (3)  │ │ Recently Viewed              │   │
│  │ NSF TechAccess       │ │ Sloan Public Understanding   │   │
│  │ Google Impact        │ │ Knight Communities           │   │
│  │ Schmidt LE Tools     │ │ NSF TechAccess               │   │
│  └─────────────────────┘ └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## KPI Definitions

| KPI | Calculation | Update Trigger |
|---|---|---|
| Active Pipeline Value | Sum of `awardSort` for all grants where status ≠ awarded/declined/closed/archived | Grant added/removed from pipeline |
| Next Deadline | Grant with fewest `daysOut` > 0 where status < submitted | Grant added, deadline changed |
| Drafted & Ready | Count of grants where status = 'review' | Draft generation, status change |
| New Matches (7d) | Count of grants where `matchedAt` within last 7 days | New match discovered |
| High-Fit Matches | Count of grants with fit ≥ 85 and status = 'matched' | Fit score change |

## System Status Panel

Must show at-a-glance health of all subsystems:

### Fully Online
```
🟢 All systems operational
   Crawler running · Last crawl 2h ago
   OpenCode connected · v2.1.0
   Storage healthy · 1.2GB free
```

### Partially Degraded
```
🟡 AI features unavailable
   Crawler running · Last crawl 2h ago
   OpenCode not reachable · Check configuration
   Storage healthy · 1.2GB free
   [Re-check] [Configure OpenCode]
```

### Fully Offline
```
🔴 Storage unavailable
   Cannot read or write grant data
   Check disk space and permissions
   [Re-check] [Troubleshoot]
```

## Internal Reports

### Grant Pipeline Report
For board/leadership review:
- Grants by status (count + value)
- Success rate (submitted → awarded)
- Average time from match → submission
- Awarded amount by funder type
- Export as CSV or print-friendly view

### Fundraising Forecast
- Projected submissions next 90 days
- Projected award value based on historical success rate
- At-risk grants (near deadline, not yet submitted)

### Annual Summary
- Total grants submitted
- Total awarded
- Success rate
- Top funders
- Lessons learned (from declined grants)

## Activity Feed

The activity feed is powered by real event records — not static text:

```typescript
interface ActivityEvent {
  id: string;
  eventType: 
    | "grant.matched"
    | "grant.status_changed"
    | "draft.generated"
    | "draft.approved"
    | "draft.revision_requested"
    | "crawl.completed"
    | "crawl.failed"
    | "crawl.partial"
    | "task.completed"
    | "task.blocked"
    | "submission.recorded"
    | "follow_up.created"
    | "follow_up.completed"
    | "award.created"
    | "expense.added"
    | "report.submitted";
  entityId: string;
  entityType: string;
  summary: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
```

## Export Formats

| Export | Format | Includes |
|---|---|---|
| Discovery results | CSV | All filtered grants with fit scores |
| Pipeline | CSV | All pipeline grants with status, deadline |
| Award report | PDF (print) | All active awards with spend-down |
| Activity log | CSV | Filtered activity events for date range |
| Full backup | ZIP | SQLite DB + all documents |
