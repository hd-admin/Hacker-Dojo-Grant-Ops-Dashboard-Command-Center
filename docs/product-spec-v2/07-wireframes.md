# 07 — Wireframes

> ASCII wireframes for key screens. These define layout and information hierarchy, not pixel-perfect design.

## Dashboard

```
+--[SIDEBAR]--+--[MAIN CONTENT]------------------------------------------+
|             |                                                          |
| Hacker Dojo |  Good afternoon, Ed.                          [↻ Refresh] |
| Grant Ops   |  Thursday · May 21 · 9 grants in pipeline  [+ New Search]|
| v0.2        |                                                          |
|             |  +--------------+ +--------------+ +--------------+ +----+
| WORKSPACE   |  | Pipeline     | | Next Deadline| | Ready to     | |New |
| ◐ Dashboard |  | $4.85M       | | 26d          | | Review       | |Matches|
| ◇ Discovery |  | 9 active     | | NSF TechAcc  | | 3 drafts     | |6 (7d)|
| ▤ Pipeline  |  | +2 this month| | Jun 16       | | awaiting you | |2 hi-fit|
| ○ Sources   |  +--------------+ +--------------+ +--------------+ +----+
| ◯ Settings  |                                                          |
|             |  +--Upcoming Deadlines---+ +--Calendar (Jun)----------+  |
|             |  | 16 JUN  NSF $1.5M    | | Mo Tu We Th Fr Sa Su    |  |
|             |  | 09 JUL  Google $500K | |       1  2  3  4  5  6 |  |
|             |  | 31 JUL  Sloan $250K  | |  7  8  9 10 11 12 13   |  |
|             |  | [View all →]         | | 14 15📅16 17 18 19 20  |  |
|             |  +----------------------+ | 21 22 23 24 25 26 27   |  |
|             |                          | 28 29 30               |  |
|             |  +--Agent Activity-------+ +----------------------+  |
|             |                                                          |
| 🟢 Crawler  |  +--System Status---------------------------------------+  |
|    online   |  | 🟢 Crawler running · 🟢 OpenCode v2.1 · 🟢 Storage  |  |
| Last: 2h ago|  +------------------------------------------------------+  |
|             |                                                          |
| ed@hackerdojo|  +--Awaiting Review (3)--+ +--Recently Viewed---------+  |
|             |  | NSF TechAccess · 92    | | Sloan Public Understand  |  |
|             |  | Google Impact · 88     | | Knight Communities       |  |
|             |  | Schmidt LE Tools · 76  | | NSF TechAccess           |  |
|             |  +-----------------------+ +--------------------------+  |
+-------------+----------------------------------------------------------+
```

## Discovery View

```
+--[SIDEBAR]--+--[MAIN CONTENT]------------------------------------------+
|             |                                                          |
|             |  Discovery                                  [+ Add Source]|
|             |  24 grants · crawled 12 sources      [+ Add Manually]    |
|             |                                              [Export CSV]|
|             |  +--Search & Filter Bar--------------------------------+ |
|             |  | [🔍 Search grants, funders, tags...]  [Best fit ▼]  | |
|             |  | [All] [Federal] [Foundation] [Corporate] [Community] | |
|             |  | [☐ Only exact deadlines]                            | |
|             |  +------------------------------------------------------+ |
|             |                                                          |
|             |  +--Title------------+--Funder---+--Award---+--Deadline--+--Fit--+
|             |  | TechAccess: AI-   | NSF       | $1.5-3M  | Jun 16    | 92 ■■■■|
|             |  | Ready America     |           |          | (exact)   |       |
|             |  +-------------------+-----------+----------+-----------+------+
|             |  | Google.org Impact | Google    | $250-500K| Jul 9     | 88 ■■■ |
|             |  | Challenge: Tech   |           |          | (exact)   |       |
|             |  +-------------------+-----------+----------+-----------+------+
|             |  | Public Underst.   | Sloan     | $50-250K | Jul 31    | 84 ■■■ |
|             |  | of Science & Tech |           |          | (exact)   |       |
|             |  +-------------------+-----------+----------+-----------+------+
|             |                                                          |
|             |  +--Sources (8 configured)-----------------------------+ |
|             |  | grants.gov · last crawl 2h ago · 12 grants          | |
|             |  | nsf.gov · last crawl 1d ago · 5 grants              | |
|             |  | google.org · last crawl 3d ago · 3 grants           | |
|             |  | ...                                                  | |
|             |  +------------------------------------------------------+ |
+-------------+----------------------------------------------------------+
```

## Pipeline (Board View)

```
+--[SIDEBAR]--+--[MAIN CONTENT]------------------------------------------+
|             |                                                          |
|             |  Pipeline                               [Board|List ▼]   |
|             |  9 active grants      [Filter: All ▼]  [+ Add to pipe]   |
|             |                                                          |
|             |  +-MATCHED(3)-+ +-DRAFT(2)-+ +-REVIEW(1)-+ +-APPROVED(1)-+ +-SUBMITTED(4)-+
|             |  |┌──────────┐| |┌────────┐| |┌──────────┐| |┌──────────┐| |┌──────────┐|
|             |  |│Sloan     │| |│Google  │| |│NSF       │| |│Knight    │| |│CalGrant  │|
|             |  |│Public    │| |│Impact  │| |│TechAccess│| |│Commun.   │| |│STEM      │|
|             |  |│$250K     │| |│$500K   │| |│$3M       │| |│$300K     │| |│$150K ✓   │|
|             |  |│Jul 31    │| |│Jul 9   │| |│Jun 16    │| |│Rolling   │| |│May 1     │|
|             |  |└──────────┘| |└────────┘| |└──────────┘| |└──────────┘| |└──────────┘|
|             |  |┌──────────┐| |┌────────┐| |            | |            | |┌──────────┐|
|             |  |│Schmidt   │| |│NSF STEM│| |            | |            | |│NSF CISE  │|
|             |  |│$200K     │| |│$1.2M   │| |            | |            | |│$800K ✓   │|
|             |  |│Aug 15    │| |│Sep 1   │| |            | |            | |│Apr 15    │|
|             |  |└──────────┘| |└────────┘| |            | |            | |└──────────┘|
|             |  +------------+ +---------+ +-----------+ +-----------+ +-----------+
+-------------+----------------------------------------------------------+
```

## Grant Detail Drawer

```
+--[MAIN CONTENT]--+--[DRAWER (640px)]-----------------------------------+
|                  |  [✕]                                                |
|                  |  NATIONAL SCIENCE FOUNDATION                        |
|                  |  TechAccess: AI-Ready America Coordination Hubs     |
|                  |                                                     |
|                  |  Award: $1.5M–$3M   LOI Due: Jun 16   Fit: 92  Draft|
|                  |                                                     |
|                  |  ─── Why It Fits ───                                |
|                  |  Mission alignment    ████████████████████ 96       |
|                  |  Geographic focus     ██████████████████░ 90        |
|                  |  Program track record █████████████████░░ 88        |
|                  |  Budget capacity      ████████████████░░░ 82        |
|                  |  Partnership readiness███████████████░░░░ 78        |
|                  |                                                     |
|                  |  ─── Requirements Checklist ───                     |
|                  |  [✓] 501(c)(3) verification  · from profile         |
|                  |  [✓] SAM.gov registration    · verified Apr 12      |
|                  |  [✓] Letter of Intent (agent)· ready for review     |
|                  |  [✓] Project summary         · drafted              |
|                  |  [ ] 3 partnership letters   · outreach drafted     |
|                  |  [ ] Logic model + eval      · in progress          |
|                  |  [ ] Budget justification     · awaits ED input      |
|                  |                                                     |
|                  |  ─── Draft Preview (v2) ───                         |
|                  |  ┌─────────────────────────────────────┐            |
|                  |  │ 1. Project Vision                   │            |
|                  |  │ Hacker Dojo proposes to anchor the  │            |
|                  |  │ Silicon Valley AI-Ready Hub...      │            |
|                  |  │ ▸ Grounded: Impact Report, NSF RFP  │            |
|                  |  └─────────────────────────────────────┘            |
|                  |                                                     |
|                  |  ─── Smart Tips ───                               |
|                  |  💡 NSF avg award to similar orgs: $2.1M            |
|                  |  💡 Emphasize "equitable access" — key priority     |
|                  |  💡 Include Mountain View Library partnership       |
|                  |                                                     |
|                  |  [Approve & Lock] [Request Revision] [Edit] [View ↗]|
+------------------+-----------------------------------------------------+
```

## Post-Award View

```
+--[SIDEBAR]--+--[MAIN CONTENT]------------------------------------------+
|             |                                                          |
|             |  Post-Award                            [+ Add Award]      |
|             |  3 active awards · $2.85M total · $640K spent (22.5%)    |
|             |                                                          |
|             |  +--NSF TechAccess · $1,500,000------------------------+ |
|             |  | Jan 2025 – Dec 2027                                  | |
|             |  | Spend-down: ████░░░░░░░░░░░░░░ 18% ($270K / $1.5M)  | |
|             |  |                                                      | |
|             |  | Category         Budget     Spent     %    Status    | |
|             |  | Personnel        $600,000   $130,000  22%  On track  | |
|             |  | Equipment        $300,000   $85,000   28%  On track  | |
|             |  | Program Delivery $400,000   $45,000   11%  ⚠ Behind  | |
|             |  | Admin/Indirect   $200,000   $10,000   5%   ⚠ Behind  | |
|             |  |                                                      | |
|             |  | Reports:                                              | |
|             |  | 📅 Q2 Progress Report — Due Jul 15 (45 days)          | |
|             |  | 📅 Annual Financial — Due Jan 31 (244 days)           | |
|             |  |                                                      | |
|             |  | Planned: Q3 Equipment — $45K (Aug) · Q4 Conf — $12K  | |
|             |  | [Add Expense] [+ Planned] [Drop Budget CSV]          | |
|             |  +------------------------------------------------------+ |
|             |                                                          |
|             |  +--Knight Communities · $300,000----------------------+ |
|             |  | Spend-down: ████████░░░░░░░░░░ 40% ($120K / $300K)  | |
|             |  +------------------------------------------------------+ |
+-------------+----------------------------------------------------------+
```

## Sources View

```
+--[SIDEBAR]--+--[MAIN CONTENT]------------------------------------------+
|             |                                                          |
|             |  Sources                                [+ Add Source]    |
|             |  12 configured · 8 active · 4 pending review              |
|             |                                                          |
|             |  +--Active Sources (8)----------------------------------+ |
|             |  |                                                        |
|             |  | grants.gov          Federal    🟢 Succeeded  2h ago    |
|             |  |  12 grants found · next crawl in 22h    [Crawl now]    |
|             |  | ─────────────────────────────────────────────────────  |
|             |  | nsf.gov             Federal    🟢 Succeeded  1d ago    |
|             |  |  5 grants found · next crawl in 47h     [Crawl now]    |
|             |  | ─────────────────────────────────────────────────────  |
|             |  | google.org          Corporate  🟡 Partial     3d ago   |
|             |  |  3 grants found · 2 pages failed         [Retry]       |
|             |  | ─────────────────────────────────────────────────────  |
|             |  | knightfoundation.org Foundation 🟢 Succeeded  5d ago   |
|             |  |  1 grant found · next crawl in 2d       [Crawl now]    |
|             |  +------------------------------------------------------+ |
|             |                                                          |
|             |  +--Pending Review (4)----------------------------------+ |
|             |  | calgrants.org       State      ⏳ Pending review       |
|             |  | Suggested by AI: "CA state grants portal" [Approve][✕]|
|             |  | ─────────────────────────────────────────────────────  |
|             |  | stemgrants.org      Foundation ⏳ Pending review       |
|             |  | Suggested by AI: "STEM education focus" [Approve][✕]  |
|             |  +------------------------------------------------------+ |
|             |                                                          |
|             |  +--Failed / Inactive (0)-------------------------------+ |
|             |  | (none)                                                | |
|             |  +------------------------------------------------------+ |
+-------------+----------------------------------------------------------+
```

## Tasks View

```
+--[SIDEBAR]--+--[MAIN CONTENT]------------------------------------------+
|             |                                                          |
|             |  Tasks                                  [+ Add Task]      |
|             |  12 open · 5 completed · 3 overdue                        |
|             |                                                          |
|             |  Filter: [All ▼] [Finance] [Program] [Review] [Follow-up] |
|             |                                                          |
|             |  +--⚠ Overdue (3)--------------------------------------+ |
|             |  |                                                        |
|             |  | [ ] Upload IRS determination letter    🔴 Overdue     |
|             |  |     NSF TechAccess · blocks submission · Due: May 1    |
|             |  | ─────────────────────────────────────────────────────  |
|             |  | [ ] Request partnership letters        🔴 Overdue     |
|             |  |     NSF TechAccess · blocks submission · Due: May 15   |
|             |  | ─────────────────────────────────────────────────────  |
|             |  | [ ] Prepare detailed budget            🔴 Overdue     |
|             |  |     Google Impact · blocks submission · Due: May 20    |
|             |  +------------------------------------------------------+ |
|             |                                                          |
|             |  +--In Progress (5)-------------------------------------+ |
|             |  |                                                        |
|             |  | [~] Finalize program logic model       🟡 In Progress |
|             |  |     NSF TechAccess · Due: Jun 1                        |
|             |  | ─────────────────────────────────────────────────────  |
|             |  | [~] Update board roster                 🟡 In Progress |
|             |  |     Sloan Public Understanding · Due: Jun 15           |
|             |  | ─────────────────────────────────────────────────────  |
|             |  | [✓] Review match: Sloan Public        🟢 Completed    |
|             |  |     Sloan Public Understanding · Done: May 28          |
|             |  +------------------------------------------------------+ |
|             |                                                          |
|             |  +--Completed (5)-------[Show completed ▼]--------------+ |
+-------------+----------------------------------------------------------+
```

## Calendar View

```
+--[SIDEBAR]--+--[MAIN CONTENT]------------------------------------------+
|             |                                                          |
|             |  Calendar                          [Month ▼] [< Jun >]   |
|             |                                                          |
|             |  +--June 2026-------------------------------------------+ |
|             |  | Mo    Tu    We    Th    Fr    Sa    Su               | |
|             |  |                        1     2     3     4     5    | |
|             |  |  6     7     8     9    10    11    12              | |
|             |  | 13    14    15  📅16    17    18    19              | |
|             |  |        📅=NSF TechAccess LOI Due                    | |
|             |  | 20    21    22    23    24    25    26              | |
|             |  | 27    28    29    30                                | |
|             |  +------------------------------------------------------+ |
|             |                                                          |
|             |  +--Upcoming--------------------------------------------+ |
|             |  |                                                        |
|             |  | Jun 16  📅 NSF TechAccess — LOI Due (17 days)         |
|             |  | Jun 30  📅 Q2 Report Due (31 days)                    |
|             |  | Jul 9   📅 Google Impact — Full Proposal (40 days)    |
|             |  | Jul 15  📅 Q2 Progress Report (46 days)               |
|             |  | Jul 31  📅 Sloan Public Understanding (62 days)       |
|             |  +------------------------------------------------------+ |
|             |                                                          |
|             |  Legend: 📅 Grant deadline · 📊 Report due · 📋 Task due  |
+-------------+----------------------------------------------------------+
```

## Pipeline (List View)

```
+--[SIDEBAR]--+--[MAIN CONTENT]------------------------------------------+
|             |                                                          |
|             |  Pipeline                             [Board|List ▼]     |
|             |  9 active grants     [Filter: All ▼] [+ Add to pipeline] |
|             |                                                          |
|             |  Title                Funder    Status    Deadline  Award|
|             |  ──────────────────── ────────  ────────  ──────── ──────|
|             |  TechAccess: AI-      NSF       Review    Jun 16   $1.5M |
|             |  Ready America Hub                                     |
|             |  ──────────────────── ────────  ────────  ──────── ──────|
|             |  Google.org Impact    Google    Draft     Jul 9    $500K |
|             |  Challenge: Social Good                                 |
|             |  ──────────────────── ────────  ────────  ──────── ──────|
|             |  Public Understanding Sloan     Matched   Jul 31   $250K |
|             |  of Science & Technology                                 |
|             |  ──────────────────── ────────  ────────  ──────── ──────|
|             |  Communities: Local   Knight    Approved  Rolling  $300K |
|             |  News & Civic Tech                                      |
|             |  ──────────────────── ────────  ────────  ──────── ──────|
|             |  CalGrant STEM        State     Submitted May 1 ✓ $150K |
|             |  Education Grant                                         |
+-------------+----------------------------------------------------------+
```

## Job Progress Component — All States

```
+--Determinate Progress--------------------------------------------------+
|  ⏳ Researching grants from NSF...                                     |
|  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░  65%                                    |
|  Stage: Analyzing results · Source: nsf.gov                            |
|                                                     [Cancel]           |
+------------------------------------------------------------------------+

+--Indeterminate Progress------------------------------------------------+
|  ⏳ Generating draft...                                                |
|  ░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓  (indeterminate)                           |
|  Stage: Structuring content                                            |
|                                                     [Cancel]           |
+------------------------------------------------------------------------+

+--Retrying (attempt badge)----------------------------------------------+
|  🔄 Schema validation failed — retrying...     [Attempt 2 of 3]        |
|  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  40%                                       |
|  Error: grants.0.title: Required                                       |
|                                                     [Cancel]           |
+------------------------------------------------------------------------+

+--Failed (after all attempts)-------------------------------------------+
|  ❌ Draft generation failed after 3 attempts                           |
|  The agent was unable to produce valid output.                         |
|                                                                        |
|  Attempt 1: Invalid JSON at line 42                                    |
|  Attempt 2: Missing required field 'grants'                            |
|  Attempt 3: Schema validation: grants.0.title: Required                |
|                                                                        |
|  [Retry]  [View session log]                                           |
+------------------------------------------------------------------------+

+--Completed (brief flash, auto-dismiss)---------------------------------+
|  ✅ Draft generated successfully                                       |
|  2,847 words · 4 sections · all grounded                               |
|  (auto-dismisses after 3s)                                             |
+------------------------------------------------------------------------+
```

## Empty States

```
+--Dashboard: No Grants, No Profile--------------------------------------+
|                    📋                                                  |
|            Get started with Grant Ops                                  |
|    Add your first grant source to discover funding                     |
|    opportunities to enable AI-powered matching.                        |
|            [Add a source]                                              |
+------------------------------------------------------------------------+

+--Discovery: No Grants Found--------------------------------------------+
|                    🔍                                                  |
|            No grants discovered yet                                    |
|    Add funding sources to start discovering grants.                    |
|    You can add websites, databases, or manually                        |
|    enter grant opportunities.                                          |
|            [Add a source]    [Add grant manually]                      |
+------------------------------------------------------------------------+

+--Discovery: Filters Yield No Results-----------------------------------+
|                    🔍                                                  |
|            No grants match your current filters                        |
|    Try broadening your search or clearing filters.                     |
|            [Clear all filters]                                         |
+------------------------------------------------------------------------+

+--Pipeline: Empty-------------------------------------------------------+
|                    📋                                                  |
|            Your pipeline is empty                                      |
|    Grants move through your pipeline from discovery                    |
|    to submission. Start by discovering grants.                         |
|            [Discover grants]    [Manage sources]                       |
+------------------------------------------------------------------------+

+--Post-Award: No Awards-------------------------------------------------+
|                    🏆                                                  |
|            No active awards yet                                        |
|    When a grant is awarded, track budgets,                             |
|    compliance, and spend-down here.                                    |
|            [View pipeline]                                             |
+------------------------------------------------------------------------+
```

## Error & Degraded States

```
+--Storage Error (blocking overlay)--------------------------------------+
|  🔴 Storage unavailable                                                |
|  Cannot read or write grant data.                                      |
|  Error: permission denied: .grant-ops-data/grant-ops.sqlite            |
|  [Re-run Health Check]    [Restore from Backup]                        |
+------------------------------------------------------------------------+

+--OpenCode Degraded (top banner)----------------------------------------+
|  🟡 AI features unavailable — OpenCode not detected on PATH            |
|  You can still browse grants, sources, and tasks.                      |
|  AI-powered research and drafting are disabled.                        |
|  [Configure OpenCode]                                     [Dismiss]    |
+------------------------------------------------------------------------+

+--Crawl Failure (dashboard card)----------------------------------------+
|  ⚠ Crawl Freshness — Crawl failed                                      |
|  nsf.gov: Connection timed out after 120s                              |
|  Other 11 sources crawled successfully.                                |
|  [Re-run crawl]                                                        |
+------------------------------------------------------------------------+

+--Crawl Stale Warning (dashboard card)----------------------------------+
|  ⚠ Crawl Freshness — Data may be stale                                 |
|  Last crawl: 5 days ago                                                |
|  New grants may have been posted since then.                           |
|  [Run discovery now]                                                   |
+------------------------------------------------------------------------+
```

## Operator Name Prompt

```
+--Welcome Dialog--------------------------------------------------------+
|                                                                        |
|  Hacker Dojo Grant Ops is ready.                                       |
|                                                                        |
|  What's your name?                                                     |
|  This will be used when drafting emails, signing grant                 |
|  cover letters, and recording submissions.                             |
|                                                                        |
|  ┌──────────────────────────────────────────────────┐                  |
|  │                                                  │                  |
|  └──────────────────────────────────────────────────┘                  |
|                                                                        |
|                              [Get Started]                             |
+------------------------------------------------------------------------+
```
