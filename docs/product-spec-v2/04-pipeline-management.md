# 04 — Pipeline & Workflow Management

## Overview

The Pipeline is the operational heart of the app — it tracks every grant from discovery through post-award, with task management, deadline tracking, and approval gates.

## Pipeline States (Expanded from v1)

```
MATCHED ──► DRAFT ──► REVIEW ──► APPROVED ──► SUBMISSION READY ──► SUBMITTED
   │                                                                    │
   │                                                                    ▼
   │                                                              FOLLOW-UP
   │                                                                    │
   │                                              ┌─────────────────────┤
   │                                              ▼                     ▼
   │                                           AWARDED              DECLINED
   │                                              │                     │
   ▼                                              ▼                     ▼
CLOSED ◄────────────────────────────────────── CLOSED                CLOSED
   │
   ▼
ARCHIVED
```

### State Definitions

| State | Meaning | Auto-Actions |
|---|---|---|
| Matched | New opportunity found | Creates task: "Review match" |
| Draft | AI drafting in progress | Creates task: "Review draft" |
| Review | Draft ready for human review | Blocks other changes |
| Approved | Human approved the draft | Locks draft, creates submission task |
| Submission Ready | All checklist items done | Creates "Submit to portal" task |
| Submitted | Evidence recorded | Creates follow-up tasks |
| Follow-up | Post-submission tracking | Creates report-due tasks |
| Awarded | Grant won! | Creates spend-down tracking |
| Declined | Not awarded | Archives with lessons learned |
| Closed | No longer active | Moves to historical view |
| Archived | Historical record | Searchable but not in active views |

## Board View (Kanban)

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ MATCHED  │ DRAFTING │ REVIEW   │ APPROVED │ SUBMITTED│
│    3     │    2     │    1     │    1     │    4     │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│┌────────┐│┌────────┐│┌────────┐│┌────────┐│┌────────┐│
││Sloan   │││Google  │││NSF     │││Knight  │││CalGrant││
││Public  │││Impact  │││TechAcc │││Commun. │││STEM    ││
││$250K   │││$500K   │││$3M     │││$300K   │││$150K   ││
││Jul 31  │││Jul 9   │││Jun 16  │││Rolling │││May 1 ✓ ││
│└────────┘│└────────┘│└────────┘│└────────┘│└────────┘│
│┌────────┐│┌────────┐│          │          │┌────────┐│
││Schmidt │││NSF STEM││          │          ││NSF CISE││
││$200K   │││$1.2M   ││          │          ││$800K   ││
││Aug 15  │││Sep 1   ││          │          ││Apr 15 ✓││
│└────────┘│└────────┘│          │          │└────────┘│
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

## Task Management

### Auto-Generated Tasks (from grant requirements)

When a grant is added to the pipeline, the system generates tasks from its requirements:

| Requirement | Auto-Task | Responsibility | Blocks |
|---|---|---|---|
| 501(c)(3) verification | Upload IRS determination letter | review | submission |
| SAM.gov registration | Verify SAM.gov active status | review | submission |
| Budget | Prepare detailed budget | finance | submission |
| Board list | Update board roster | program | — |
| Letters of support | Request partnership letters | program | submission |
| Logic model | Finalize program logic model | program | — |

### Task States & Blocking

Tasks can be:
- **Blocked** (waiting on external dependency)
- **In Progress** (being worked on)
- **Completed** (done, with evidence)
- **Waived** (not applicable, with justification)
- **Not Applicable** (skipped with reason)

Tasks marked `blockSubmission: true` prevent the grant from moving to "Submission Ready".

## Filters & Views

### List View
For spreadsheet-minded users. Columns: Grant Title, Funder, Status, Deadline, Award, Responsibility, Urgency.

### Board View (default)
Kanban columns per pipeline state. Cards do **not** move by drag-and-drop. Each card exposes an explicit "Move to…" action menu with confirmation for irreversible moves like "Submitted".

### Filters
- By status, responsibility tag, urgency, funder type
- "Show only overdue" (deadline passed, not yet submitted)
- "Show only my review queue" (status = review)
- "Show awarded this year"

## Deadline Intelligence

### Urgency Classification
- **Overdue**: deadline passed, status < submitted
- **Urgent**: < 30 days remaining
- **Soon**: 30-60 days
- **Normal**: 60+ days or rolling

### Deadline Confidence Handling
- **Exact**: firm date from source → shown with calendar icon
- **Estimated**: approximate date → shown with "~" prefix
- **Rolling**: no fixed deadline → shown as "Rolling"
- **Unknown**: no deadline data → shown as "Deadline unknown"

The UI must never infer certainty where the source data is ambiguous. This is a hard requirement from the acceptance criteria.

## Calendar Integration

The app does NOT sync with external calendar services — that would violate the local-first, zero-cloud principle. Instead, it generates local `.ics` files (via `ical-generator` v10.2.0) that the operator can import into any calendar application (macOS Calendar, Google Calendar, Outlook) as a one-time import or recurring manual refresh.

**Export workflow:**
1. Operator clicks "Export Calendar" from the Calendar view
2. App generates an `.ics` file at `.grant-ops-data/exports/calendar.ics` containing:
   - Grant deadlines with 24h and 1h before alarms
   - Report due dates with 48h before alarms
   - Follow-up task due dates
3. Operator opens the `.ics` file — macOS Calendar imports it automatically
4. To update: operator clicks "Export Calendar" again for a fresh `.ics` file

**Built-in calendar view** within the app shows:
- Grant deadlines color-coded by urgency (overdue red, urgent orange, soon yellow, normal blue)
- Reporting due dates from awarded grants
- Follow-up task due dates
- Monthly and weekly toggle views

No double data entry. No cloud dependency. The operator controls when and where calendar data is exported.

## Outreach Tracking

For grant requirements that need input from others (board members, program staff, partners), the system tracks outreach:

- Log who was contacted, when, and via what method (email, phone, in-person)
- Track response status: awaiting reply, confirmed, declined
- Generate email drafts for partnership requests, board approvals, budget sign-offs
- Attach responses (forwarded emails, notes from calls) to the grant record
- Flag overdue outreach: "Partnership letter from Mountain View Library — requested 14 days ago, no response"

All outreach records stay local. Nothing is shared externally by the app — the operator does the actual communication.

## Custom Tracker Fields

Beyond the standard pipeline fields, the operator can add custom tracking columns: program area, strategic priority, ED priority level, board interest. These custom fields are filterable and appear in the list view and board cards.

## State Transition Logging

Every pipeline state change is logged:
```typescript
interface PipelineTransition {
  id: string;
  grantId: string;
  fromState: GrantStatus;
  toState: GrantStatus;
  timestamp: string;
  actor: "user" | "system";
  reason?: string;
}
```

This powers the audit log and activity feed.

## Scope Boundaries

- State changes use explicit actions with confirmation, not drag-and-drop
- Single operator; responsibility tags are workflow categories, not multi-user assignments
- No CRM integrations — local-only data
