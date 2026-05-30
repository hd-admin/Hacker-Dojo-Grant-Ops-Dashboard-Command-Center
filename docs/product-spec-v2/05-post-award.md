# 05 — Post-Award Management

## Overview

Post-award management tracks grants after they're won — budgets, compliance deadlines, reporting obligations, and spend-down. Everything stays local; no accounting software integration required for v2.

## Key Features

### 1. Award Letter Extraction
Upload the award letter (PDF/DOCX). OpenCode extracts structured data into a typed artifact: amount, start/end dates, reporting deadlines, budget categories, compliance requirements, program officer contact info. All extracted data is reviewed and confirmed by the operator before ingestion.

### 2. Spend-Down Tracking
Manual expense entry per budget category (no accounting software integration for v2). Track budget vs actual with visual progress bars. Flag categories that are significantly over or under target relative to the grant timeline.

### 3. Compliance Calendar
Extracted reporting deadlines auto-populate with reminders. Track submission status per report (pending, submitted, overdue). Reminders X days before due.

### 4. Awards Overview
Central view showing:
- Active awards with spend-down progress bars
- Upcoming reporting deadlines
- Per-award compliance checklist
- Total awarded/remaining across all grants

### 5. Drag and Drop Budget Imports
Upload the funder-approved budget (PDF, spreadsheet, or CSV). The system extracts budget categories and amounts automatically. The operator can drag to reorder, adjust amounts, and map funder budget lines to internal tracking categories before confirming.

### 6. Planned Expenses
Log planned future expenses against budget categories to see the full spending picture — not just what's been spent. "We plan to spend $45K on equipment in Q3" — this shows in forecasts and helps catch timing issues before they become compliance problems.

### 7. Budget vs Actual Reports
Export-ready reports showing budget vs actual spending per category. Color-coded: green (on track), yellow (slightly behind/ahead), red (significantly off track). Reports include percentage complete relative to grant timeline, so "22% spent but 40% through the period" is immediately visible.

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  POST-AWARD VIEW                                             │
│                                                             │
│  ┌─ Awards Overview ────────────────────────────────────┐   │
│  │  Active Awards: 3                                     │   │
│  │  Total Awarded: $2,850,000                            │   │
│  │  Total Spent: $640,000 (22.5%)                        │   │
│  │  Total Remaining: $2,210,000                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ NSF TechAccess · $1,500,000 ────────────────────────┐   │
│  │  Period: Jan 2025 – Dec 2027                           │   │
│  │  Spend-down: ████░░░░░░░░░░░░░░ 18% ($270K of $1.5M) │   │
│  │                                                       │   │
│  │  Budget Categories:                                    │   │
│  │  ┌──────────────────┬──────────┬──────────┬────────┐  │   │
│  │  │ Category         │ Budget   │ Spent    │ %      │  │   │
│  │  ├──────────────────┼──────────┼──────────┼────────┤  │   │
│  │  │ Personnel        │ $600,000 │ $130,000 │ 22%    │  │   │
│  │  │ Equipment        │ $300,000 │ $85,000  │ 28%    │  │   │
│  │  │ Program Delivery │ $400,000 │ $45,000  │ 11% ⚠️ │  │   │
│  │  │ Admin/Indirect   │ $200,000 │ $10,000  │ 5%  ⚠️ │  │   │
│  │  └──────────────────┴──────────┴──────────┴────────┘  │   │
│  │                                                       │   │
│  │  Upcoming Reports:                                     │   │
│  │  📅 Q2 Progress Report — Due Jul 15 (45 days)          │   │
│  │  📅 Annual Financial Report — Due Jan 31 (244 days)    │   │
│  │                                                       │   │
│  │  [Add Expense] [Upload Report] [View Award Letter]     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Knight Communities · $300,000 ──────────────────────┐   │
│  │  Spend-down: ████████░░░░░░░░░░ 40% ($120K of $300K) │   │
│  │  ...                                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Award Letter Extraction

### Upload → Extract → Confirm Flow

1. User uploads award letter (PDF/DOCX)
2. App sends to OpenCode with extraction prompt
3. OpenCode writes `tmp/extract-{jobId}.json` (ExtractArtifact schema)
4. App typechecks, renders extracted data for review
5. User confirms or corrects each field
6. Confirmed data creates: budget categories, reporting deadlines, compliance tasks

### Extraction Schema

```typescript
interface AwardExtraction {
  amount: string;           // "$1,500,000"
  startDate: string;        // "2025-01-15"
  endDate: string;          // "2027-12-31"
  reportingDeadlines: Array<{
    type: string;           // "Quarterly Progress Report"
    dueDate: string;        // "2025-07-15"
    format: string;         // "PDF via grants.gov"
  }>;
  budgetCategories: Array<{
    category: string;       // "Personnel"
    amount: string;         // "$600,000"
    restrictions?: string;  // "Cannot exceed 40% of total"
  }>;
  complianceRequirements: string[];
  specialConditions: string[];
  programOfficer?: {
    name: string;
    email: string;
    phone?: string;
  };
}
```

## Spend-Down Alerts

### Over-Spending Alert
> ⚠️ **Equipment budget over target**: You've spent 95% of the equipment budget but the grant period is only 40% complete. Review expenses or request a budget modification.

### Under-Spending Alert
> ⚠️ **Program Delivery behind schedule**: Only 11% of the program budget spent, but the grant is 25% through its period. Risk of unspent funds at year-end.

### Reporting Reminder
> 📅 **Q2 Progress Report due in 14 days**: The NSF requires a quarterly progress report via grants.gov by July 15.

## Data Model

```typescript
interface Award {
  id: string;
  grantId: string;
  amount: number;
  startDate: string;
  endDate: string;
  awardLetterDocumentId?: string;
  extractionConfidence: "high" | "medium" | "low";
  budgetCategories: AwardBudgetCategory[];
  reportingDeadlines: AwardReportDeadline[];
  complianceItems: AwardComplianceItem[];
}

interface AwardBudgetCategory {
  id: string;
  category: string;
  budgetedAmount: number;
  spentAmount: number;
  lastUpdated: string;
  expenses: AwardExpense[];
}

interface AwardExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  receiptDocumentId?: string;
  notes?: string;
}

interface AwardReportDeadline {
  id: string;
  type: string;
  dueDate: string;
  format: string;
  status: "pending" | "submitted" | "overdue";
  submittedAt?: string;
  documentId?: string;
}

interface AwardComplianceItem {
  id: string;
  requirement: string;
  status: "compliant" | "at-risk" | "non-compliant";
  evidence?: string;
  dueDate?: string;
}
```

## Scope Boundaries

- Manual expense entry — no accounting software or bank sync integrations
- Single-organization tracking — no multi-entity consolidation
- Operational tracking, not CPA-grade financial reporting
