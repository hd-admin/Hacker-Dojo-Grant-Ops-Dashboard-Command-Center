# 11 — Technical Infrastructure

> **Status**: Draft v2 — fills gaps identified in May 2026 spec audit.
> **Covers**: Technology stack, API routes, document management, search, notifications, configuration, peer discovery data sources, logging, backup scheduling, resource monitoring, app identity.
> **Database schema**: See [12-data-architecture.md](./12-data-architecture.md).

---

## Technology Stack

> **⚠️ VERSION PINNING**: All versions below are the **latest stable releases as of May 30, 2026**. These are NOT permanent — they MUST be re-checked and updated before any new development cycle begins. Check each package on npmjs.com and the Node.js release schedule. Do NOT assume these versions remain current beyond this date. See the [Version Update Protocol](#version-update-protocol) at the end of this section for the checklist.

This is a local-only desktop application. Application data persistence is fully local — no hosted database, no SaaS backend, no cloud storage. Optional AI features (via OpenCode) and optional external data sources (for example operator-enabled grant APIs like ProPublica) may require internet access, but the app remains fully functional for manual tracking while offline.

### Runtime & Framework

| Package | Version | Release Date | Notes |
|---|---|---|---|
| **Node.js** | **v24.16.0** (Active LTS) | 2026-05-21 | Codename: Krypton. v22 is Maintenance LTS. |
| **Next.js** | **v16.2.6** (LTS) | 2026-05-07 | App Router. Binding to `127.0.0.1` only via `-H 127.0.0.1`. |
| **React** | **v19.2.6** | 2026-05-06 | |
| **TypeScript** | **v6.0.3** | 2026-04-16 | Strict mode. No `any`, no `@ts-ignore`. |

### Database

| Package | Version | Notes |
|---|---|---|
| **better-sqlite3** | **v12.10.0** | Bundles SQLite 3.53.1. Requires Node.js v20+. Synchronous API. |
| **SQLite** | **3.53.1** | Bundled inside better-sqlite3. WAL mode, FTS5. |

### Schema Validation

| Package | Version | Notes |
|---|---|---|
| **Zod** | **v4.4.3** | All API inputs, agent artifacts, and database records validated with Zod. |

### Document Parsing

| Format | Library | Version | Notes |
|---|---|---|---|
| **PDF** (simple text) | `pdf-parse` | `^2.0.0` | Wraps pdfjs-dist. For plain text extraction from grant docs. |
| **PDF** (layout-aware) | `pdfjs-dist` | `^5.7.284` | Mozilla's PDF.js. For complex/scanned award letters. |
| **DOCX** | `mammoth` | `^1.12.0` | `.extractRawText()` for clean semantic text; `.convertToHtml()` for structure. |
| **CSV** | `csv-parse` | `^5.6.0` | Most robust, RFC 4180 compliant, memory-efficient streaming. |
| **XLSX** | `xlsx` (SheetJS) | `0.20.3` | Vendored tarball in the repo (for example `vendor/xlsx-0.20.3.tgz`). npm registry is stale (0.18.5, 2022); do not rely on a live CDN during install. |
| **Budget schema** | `excel-zod` | `^1.0.0` | Type-safe column mapping with Zod schemas, auto header detection. |

### File Operations

| Purpose | Library | Version | Notes |
|---|---|---|---|
| **Backup zip** | `adm-zip` | `v0.5.17` | Actively maintained (Apr 2026). Alternative to stale `jszip` (v3.10.1, 2022). |
| **iCal export** | `ical-generator` | `v10.2.0` | Full TypeScript types, events + alarms + timezone support. |
| **File integrity** | `node:crypto` | built-in | SHA-256 streaming hash, `crypto.randomUUID()` for filenames. No npm package needed. |
| **MIME validation** | `file-type` | `^19.0.0` | Magic number sniffing for upload validation (not just client-reported MIME). |
| **Canvas (standalone)** | `@napi-rs/canvas` | `^0.1.0` | Required for pdfjs-dist on Next.js standalone builds only. |

### Logging & Security

| Purpose | Library | Version | Notes |
|---|---|---|---|
| **Server-only guard** | `server-only` | latest | Build-time guard preventing DB/filesystem modules from being imported into client components. |
| **Logging** | `pino` | `^10.3.1` | 5-8x faster than Winston. Structured JSON output. |
| **Log rotation** | `pino-roll` | `^4.0.0` | Daily rotation with size limits. Worker-thread transport. |

### Testing

| Package | Version | Notes |
|---|---|---|
| **Vitest** | **v4.1.7** | Unit + integration tests. |
| **Playwright** | **v1.60.0** | E2E browser tests. `@playwright/test` same version. |

### Build & Quality

| Tool | Purpose |
|---|---|
| **pnpm** | Package manager (no npm, no yarn). |
| **ESLint + Prettier** | Linting and formatting. |
| **npx knip** | Dead code detection (run before significant commits). |

### Key Architectural Rules

1. **`server-only`**: All database and filesystem modules MUST import `'server-only'` — build-time error if leaked to client.
2. **`await connection()`**: All synchronous better-sqlite3 queries in Route Handlers MUST call `await connection()` from `next/server` first to prevent prerendering.
3. **`serverExternalPackages: ['better-sqlite3']`**: In `next.config.ts` — prevents bundling native modules.
4. **No `NEXT_PUBLIC_` prefix**: Server-only variables don't need it — this app is never deployed.
5. **Single writer connection**: One `better-sqlite3` connection for all writes. 4 read replicas (round-robin) for concurrent reads.
6. **All file paths use `path.join()`**: Never string concatenation. Always resolve from `process.cwd()`.
7. **Output: `standalone`**: `next.config.ts` → `output: 'standalone'` for `node .next/standalone/server.js`.

### next.config.ts

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native modules must not be webpack-bundled
  serverExternalPackages: ['better-sqlite3'],

  // Standalone output for local desktop distribution
  output: 'standalone',

  // Local app — no CDN image optimization needed
  images: { unoptimized: true },

  // Disable X-Powered-By for local security hygiene
  poweredByHeader: false,

  // For file uploads via Server Actions (if used)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev -H 127.0.0.1 -p 3000",
    "build": "next build",
    "start": "HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx && prettier --check .",
    "deadcode": "npx knip"
  }
}
```

### Version Update Protocol

Before starting any new development cycle, run this checklist to ensure all pinned versions are still valid:

```bash
# 1. Check Node.js LTS schedule
node --version  # compare against https://nodejs.org/en/about/previous-releases

# 2. Check each npm package for newer versions
npx npm-check-updates --filter "next,react,typescript,better-sqlite3,zod,csv-parse,mammoth,pino,pino-roll,ical-generator,adm-zip,vitest,playwright,file-type,@napi-rs/canvas,server-only"

# 3. Check upstream SheetJS release notes, then refresh the vendored tarball in `vendor/`
# Do not rely on a live CDN during install

# 4. Check Context7 or npmjs.com for pdf-parse and pdfjs-dist
npx npm-check-updates --filter "pdf-parse,pdfjs-dist,excel-zod"

# 5. Run the test suite after any version bumps
pnpm typecheck && pnpm lint && pnpm test
```

**Version bump rules:**
- **PATCH** bumps (x.y.Z): auto-accept after tests pass
- **MINOR** bumps (x.Y.z): review changelog for breaking changes, test manually
- **MAJOR** bumps (X.y.z): full review required — check migration guides, breaking changes, API surface changes. Do NOT blindly upgrade major versions.

---

## 1. API Route Specification

All routes are served from `localhost` only (Next.js bound to `127.0.0.1`). Every response follows the AC-14.10 error contract shape. All inputs are validated with Zod.

### 1.1 — Grants

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/grants` | List grants (paginated, filterable) |
| `GET` | `/api/grants/{id}` | Single grant with full details |
| `POST` | `/api/grants` | Create grant manually |
| `PUT` | `/api/grants/{id}` | Update grant fields |
| `DELETE` | `/api/grants/{id}` | Delete grant (soft-delete: sets `deletedAt`) |
| `POST` | `/api/grants/{id}/transition` | Execute pipeline state transition |
| `GET` | `/api/grants/{id}/history` | State transition history |
| `GET` | `/api/grants/{id}/tasks` | Tasks for this grant |
| `GET` | `/api/grants/{id}/documents` | Documents linked to this grant |
| `GET` | `/api/grants/{id}/drafts` | Draft versions for this grant |
| `PUT` | `/api/grants/{id}/fit-score` | Recalculate fit score |

**`GET /api/grants` Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | GrantStatus | — | Filter by pipeline status |
| `funderType` | string | — | Filter by funder type |
| `minFit` | number | — | Minimum fit score |
| `maxDeadline` | string (ISO) | — | Deadline before this date |
| `search` | string | — | FTS5 search query |
| `sort` | string | `"createdAt"` | Sort field |
| `order` | `"asc"` \| `"desc"` | `"desc"` | Sort direction |
| `page` | number | `1` | Page number |
| `pageSize` | number | `25` | Results per page (max 100) |

**`POST /api/grants/{id}/transition` Request Body:**
```json
{
  "toState": "draft",
  "reason": "Started drafting",
  "notes": "Optional context about why"
}
```

### 1.2 — Sources

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/sources` | List all sources |
| `POST` | `/api/sources` | Add a new source |
| `PUT` | `/api/sources/{id}` | Update source config |
| `DELETE` | `/api/sources/{id}` | Remove source + related data |
| `POST` | `/api/sources/{id}/crawl` | Trigger manual crawl |
| `GET` | `/api/sources/{id}/crawls` | Crawl history for source |

Deleting a source MUST set `grants.sourceId` to `NULL` on linked grants; grant records remain intact.
Per-source crawl history is persisted in the `crawl_runs` table and linked to both `sourceId` and the agent `jobId`.

### 1.3 — Tasks

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/tasks` | List tasks (filterable by grant, status, responsibility) |
| `POST` | `/api/tasks` | Create task |
| `PUT` | `/api/tasks/{id}` | Update task (status, notes, assignment) |
| `DELETE` | `/api/tasks/{id}` | Delete task |

### 1.4 — Documents

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/documents` | List documents (filterable by grant, type, tag) |
| `POST` | `/api/documents` | Upload document (multipart form) |
| `GET` | `/api/documents/{id}` | Download document file |
| `GET` | `/api/documents/{id}/text` | Extracted text content |
| `PUT` | `/api/documents/{id}` | Update document metadata |
| `DELETE` | `/api/documents/{id}` | Delete document |

Document upload validates: file size ≤ 50MB, allowed extensions (`.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.csv`, `.txt`, `.png`, `.jpg`, `.jpeg`), MIME type matches extension.

### 1.5 — Agent Jobs

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/jobs` | Start a new job (research, draft, crawl, match, extract) |
| `GET` | `/api/jobs` | List all jobs (active + recent) |
| `GET` | `/api/jobs/{jobId}` | Job status and progress (poll every 2s) |
| `POST` | `/api/jobs/{jobId}/cancel` | Cancel running job |

### 1.6 — Drafts

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/drafts/{grantId}` | List draft versions |
| `GET` | `/api/drafts/{grantId}/{version}` | Get specific draft version |
| `POST` | `/api/drafts/{grantId}` | Generate new draft (spawns agent job) |
| `POST` | `/api/drafts/{grantId}/revise` | Request revision of latest draft |
| `POST` | `/api/drafts/{grantId}/approve` | Approve and lock draft |
| `POST` | `/api/drafts/{grantId}/reopen` | Reopen locked draft |
| `GET` | `/api/drafts/{grantId}/diff` | Diff between two versions (query: `v1`, `v2`) |

### 1.7 — Settings & Configuration

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/settings` | Get current settings |
| `PUT` | `/api/settings` | Update settings |
| `GET` | `/api/settings/operator` | Get operator name |
| `PUT` | `/api/settings/operator` | Set operator name |

### 1.8 — Awards & Post-Award

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/awards` | List awards (filterable) |
| `POST` | `/api/awards` | Create award (from grant) |
| `PUT` | `/api/awards/{id}` | Update award |
| `GET` | `/api/awards/{id}/expenses` | List expenses |
| `POST` | `/api/awards/{id}/expenses` | Add expense |
| `PUT` | `/api/awards/{id}/expenses/{expenseId}` | Update expense |
| `DELETE` | `/api/awards/{id}/expenses/{expenseId}` | Delete expense |
| `GET` | `/api/awards/{id}/reports` | Report deadlines |
| `POST` | `/api/awards/{id}/reports/{reportId}/submit` | Mark report submitted |

### 1.9 — Snippets (Institutional Memory)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/snippets` | List snippets (searchable by topic, funder, program) |
| `POST` | `/api/snippets` | Create snippet from approved draft section |
| `PUT` | `/api/snippets/{id}` | Update snippet |
| `DELETE` | `/api/snippets/{id}` | Delete snippet |

### 1.10 — Saved Searches

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/saved-searches` | List saved searches |
| `POST` | `/api/saved-searches` | Create saved search |
| `PUT` | `/api/saved-searches/{id}` | Update saved search |
| `DELETE` | `/api/saved-searches/{id}` | Delete saved search |

### 1.11 — Funder Profiles

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/funders` | List cached funder profiles |
| `GET` | `/api/funders/{id}` | Single funder profile with giving history + insights |
| `PUT` | `/api/funders/{id}` | Update operator-curated funder metadata |

### 1.12 — Application Form Templates

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/forms` | List known funder form templates |
| `GET` | `/api/forms/{id}` | Get single form template |
| `POST` | `/api/forms` | Create operator-defined form template |
| `PUT` | `/api/forms/{id}` | Update form template |
| `DELETE` | `/api/forms/{id}` | Delete form template |

### 1.13 — Outreach Tracking

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/outreach?grantId={id}` | List outreach records for a grant |
| `POST` | `/api/outreach` | Create outreach record |
| `PUT` | `/api/outreach/{id}` | Update outreach record / response status |
| `DELETE` | `/api/outreach/{id}` | Delete outreach record |

### 1.14 — Peer Organizations

Peer organizations are stored in the `sources` table with `type='peer'`. They use the same API routes as sources (§1.2) but are filtered by type.

### 1.15 — Backup & Restore

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/backup` | Create backup (returns .zip path) |
| `POST` | `/api/backup/restore` | Restore from backup .zip |
| `GET` | `/api/backup/status` | Last backup info + scheduled status |
| `PUT` | `/api/backup/schedule` | Configure auto-backup interval |

### 1.16 — Calendar (Local iCal Export)

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/calendar/deadlines` | Grant deadline events |
| `GET` | `/api/calendar/reports` | Report due date events |
| `GET` | `/api/calendar/export` | Export all events as `.ics` file |
| `GET` | `/api/calendar/export/{scope}` | Export filtered scope: `grants`, `reports`, `all` |

### 1.17 — Activity & Audit

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/activity` | Activity events (paginated, filterable) |
| `GET` | `/api/activity/{entityType}/{entityId}` | Activity for specific entity |

### 1.18 — Health & Diagnostics

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | System health check |
| `GET` | `/api/health/db` | Database integrity + WAL status |
| `GET` | `/api/health/disk` | Disk space in `.grant-ops-data/` |
| `GET` | `/api/health/opencode` | OpenCode detection + version |

### 1.19 — Logs

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/logs/app` | Stream or paginate application logs |
| `GET` | `/api/logs/error` | Stream or paginate error logs |
| `GET` | `/api/logs/session/{jobId}` | View specific OpenCode session log |

### 1.20 — Exports

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/exports/grants` | Export grants as CSV |
| `GET` | `/api/exports/pipeline` | Export pipeline as CSV |
| `GET` | `/api/exports/awards` | Export awards report as CSV |
| `GET` | `/api/exports/activity` | Export activity log as CSV |

---

## 2. Database Schema

The complete database schema — all 19 tables, indexes, FTS5 virtual tables, connection configuration, WAL pragmas, migration strategy, seed data, and backup considerations — is defined in **[12-data-architecture.md](./12-data-architecture.md)**.

**Key points:**
- better-sqlite3 v12.10.0, SQLite 3.53.1, WAL mode
- Single writer connection + 4 read replicas (round-robin)
- PRAGMA config: `busy_timeout=5000`, `synchronous=NORMAL`, `cache_size=-64000`, `wal_autocheckpoint=1000`, `foreign_keys=ON`, `mmap_size=268435456`
- Standalone FTS5 table with `grantId` plus AI/AD/AU triggers on the `grants` table
- All foreign keys use `ON DELETE CASCADE` or `ON DELETE SET NULL` as appropriate
- JSON columns (`TEXT DEFAULT '[]'` or `TEXT DEFAULT '{}'`) for flexible fields (tags, fit breakdown, custom tracker fields, agent params)
- Soft deletes via `deletedAt` column on grants and documents
- Schema initialization on first run plus forward-only v2 migration scripts for future schema changes (see 12 §4)

---

## 3. Document Management & Storage

### 3.1 — Directory Structure

```
.grant-ops-data/
  documents/
    {uuid}.{ext}            # Stored by UUID to avoid name collisions
  documents/thumbnails/     # Generated thumbnails for image previews
  documents/extracted/      # Cached extracted text (for large PDFs)
```

### 3.2 — Upload Pipeline

1. File uploaded via `POST /api/documents` (multipart form with file + metadata fields)
2. Validate: size ≤ 50MB, extension in allowed list (`.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.csv`, `.txt`, `.png`, `.jpg`, `.jpeg`), MIME type server-checked via `file-type` package (magic number sniffing, not just extension)
3. Generate UUID filename, write to temp path first → create DB record → rename to final path on success
4. Compute SHA-256 checksum via `node:crypto` and store in `documents.checksum`
5. Queue text extraction (see §3.3)
6. On extraction success: store text in `extractedText`, status → `extracted`
7. On extraction failure: status → `stored_unparsed` (unsupported format) or `failed` (corrupt file)

### 3.3 — Text Extraction

| Format | Library | Version | Method |
|---|---|---|---|
| **PDF** (simple) | `pdf-parse` | `^2.0.0` | `pdf(buffer).then(data => data.text)` — wraps pdfjs-dist internally |
| **PDF** (complex/scanned) | `pdfjs-dist` | `^5.7.284` | `getDocument().promise` → `page.getTextContent()` — layout-aware extraction |
| **DOCX** | `mammoth` | `^1.12.0` | `mammoth.extractRawText({buffer})` — clean semantic text for AI grounding |
| **CSV** | `csv-parse` | `^5.6.0` | Streaming: `createReadStream().pipe(parse({columns: true, cast: true}))` |
| **XLSX** | `xlsx` (SheetJS) | `0.20.3` | `XLSX.read(buffer, {type:'buffer'})` → `XLSX.utils.sheet_to_json()` |
| **TXT** | `node:fs` | built-in | `fs.readFileSync(path, 'utf-8')` |
| **Images** | — | — | No text extraction. Stored as binary reference only. |

**⚠️ Next.js Standalone Build Note**: `pdf-parse` wraps `pdfjs-dist`, which requires browser globals. On Next.js standalone builds, add `@napi-rs/canvas` and configure `serverExternalPackages` in `next.config.ts`.

### 3.4 — Document Classification

| Classification | AI Grounding | Backup |
|---|---|---|
| `canonical` | Used as source of truth for drafting | Always included |
| `draft-only` | Used for drafting context | Always included |
| `restricted` | **Never** sent to OpenCode | Always included |

---

## 4. Search Implementation

### 4.1 — Grant Search

Grants use **SQLite FTS5** with the `grants_fts` virtual table. Full-text search runs across: `title`, `funder`, `funderShort`, `summary`, `eligibility`, `tags`, `category`.

**Search URI** (via `GET /api/grants?search=...`):
- Plain text: SQLite FTS5 query on concatenated text fields
- Ranked by FTS5 relevance (`bm25`)
- Combined with status/funder/fit filters
- Results ≤ 200ms for 500 grants (FTS5 + indexed filters)

### 4.2 — Natural Language Search

The "smart search" described in 02-discovery-prospecting works as follows:
1. User types natural-language query into the discovery search bar
2. The query is passed to OpenCode via the agent loop (`research` job type)
3. OpenCode interprets the query, searches configured sources, and returns structured results via `ResearchArtifact`
4. Results are ingested and displayed in the discovery view

The keyword/filter bar (funder type, deadline confidence, sort) operates on locally indexed data using FTS5 and indexed columns — no agent involvement.

### 4.3 — Snippet Search

Snippets are searched client-side on the indexed `topicTags` and `programArea` fields. The snippet library is small enough (hundreds, not thousands) that full client-side filtering is adequate.

---

## 5. Notification System

### 5.1 — Toast Notifications

Toast notifications are in-memory only (no database persistence). They are triggered by:
- Job completion or failure (agent loop events)
- Crawl completion or failure
- Backup completion
- Deadline approaching (when app is open)

**Toast Schema:**
```typescript
interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  action?: { label: string; href: string };  // e.g., "View grant"
  duration: number;  // ms, 0 = sticky
  timestamp: number;
}
```

**Toast behavior:**
- Stack from top-right, max 3 visible
- Auto-dismiss after `duration` ms (default 5000ms for success/info, sticky for errors)
- Dismissible via close button
- Action link navigates to relevant view

### 5.2 — In-App Notification Center

The sidebar shows an unread badge count. Clicking opens a drawer listing recent activity events from the `activity_events` table. Not persisted as "read/unread" — the badge count is derived from events since last session start (stored in `localStorage`).

### 5.3 — System-Driven Notifications

| Trigger | Type | Message |
|---|---|---|
| Crawl completed | success | "Crawl completed: {source} — {n} new grants found" |
| Crawl failed | error | "Crawl failed for {source}: {error}" |
| Draft generated | success | "Draft v{n} generated for {grant}" |
| Draft failed | error | "Draft generation failed after {n} attempts" |
| Backup completed | success | "Backup saved to {path}" |
| Backup failed | error | "Backup failed: {error}" |
| Deadline < 7 days | warning | "{grant} deadline in {n} days" |
| Report due < 14 days | warning | "{report} due in {n} days" |
| Source stale > 7d | warning | "{source} crawl is {n} days stale" |

---

## 6. Budget Import Parsing

### 6.1 — Supported Formats

| Format | Library | Version | Strategy |
|---|---|---|---|
| CSV | `csv-parse` | `^5.6.0` | Streaming: `createReadStream().pipe(parse({columns: true, cast: true}))` |
| XLSX | `xlsx` (SheetJS) | `0.20.3` | `XLSX.read(buffer)` → `sheet_to_json()` with sheet detection and header row detection |
| CSV/XLSX (typed) | `excel-zod` | `^1.0.0` | Zod schema → auto-detect headers → type-safe column mapping |
| PDF (tabular budget) | OpenCode subprocess | — | Extract via agent loop, returned as `ExtractArtifact` budget fields |

### 6.2 — Budget Import Flow

1. User drags file onto the award budget panel or clicks "Drop Budget CSV"
2. File is parsed server-side via `POST /api/documents` (with `classification=draft-only`)
3. Budget categories are extracted and presented for review: a table of `{category, amount}` pairs
4. User maps funder budget lines to internal tracking categories via drag-to-reorder and dropdown mapping
5. User confirms → budget categories created in `award_budget_categories`

### 6.3 — Column Detection Heuristic

The CSV/XLSX parser:
1. Reads first 10 rows
2. Detects header row by searching for budget-related keywords: `category`, `item`, `line`, `description`, `amount`, `budget`, `total`, `cost`, `expense`
3. If no header detected, assumes row 1 is the header
4. Maps columns: finds the column most likely to be "category" and "amount" by keyword matching
5. Presents mapping to user for confirmation before ingestion

---

## 7. Configuration & Operator Preferences

All configurable settings are stored in the SQLite `settings` key-value table. The Settings UI is the only supported editing surface. There is no generated `settings.json` shadow file.

### 7.1 — Setting Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `operator.name` | string | `""` | Operator name (only name prompt) |
| `agent.autoDraftThreshold` | integer | `75` | Fit score threshold for auto-draft suggestion |
| `agent.voiceAndTone` | string | hardcoded profile | Voice/tone rules for drafting |
| `agent.maxConcurrentJobs` | integer | `3` | Max concurrent OpenCode subprocesses |
| `crawl.defaultIntervalHours` | integer | `168` | Default crawl interval for new sources |
| `crawl.maxConcurrentCrawls` | integer | `1` | Max concurrent crawl jobs |
| `crawl.requestDelayMs` | integer | `2000` | Minimum delay between requests to the same source |
| `crawl.respectRobotsTxt` | integer | `1` | Whether crawls honor `robots.txt` restrictions |
| `crawl.userAgent` | string | `"HackerDojoGrantOps/2.0 (+https://hackerdojo.org)"` | User-Agent string used for external crawls |
| `ui.theme` | string | `"dark"` | Theme (only "dark" supported in v2) |
| `backup.autoEnabled` | integer | `0` | Auto-backup enabled |
| `backup.autoIntervalHours` | integer | `168` | Auto-backup interval |
| `backup.autoPath` | string | `""` | Auto-backup directory path |
| `integrations.propublicaApiKey` | string | `""` | Optional API key for ProPublica Nonprofit API. If unset, peer/funder 990 enrichment is disabled. |
| `notifications.deadlineWarningDays` | integer | `7` | Days before deadline to warn |
| `notifications.reportWarningDays` | integer | `14` | Days before report due to warn |

### 7.2 — Operator Name

The operator name is the **only** field prompted at first launch (see 01-core-concept). It is stored in the `settings` table under `operator.name`. It is used in:
- Email draft salutations and signatures
- Submission record "submitted by" field
- Draft approval records
- Activity log actor field

### 7.3 — Custom Tracker Fields

Custom tracker fields (pipeline management feature: program area, strategic priority, ED priority level, board interest) are stored as JSON in a `settings.customFields` key:

```json
[
  { "key": "programArea", "label": "Program Area", "type": "text", "visible": true },
  { "key": "strategicPriority", "label": "Strategic Priority", "type": "select", "options": ["High","Medium","Low"], "visible": true }
]
```

These fields are rendered in grant detail views and the pipeline list view. Changes to custom fields are applied to existing grants immediately (new fields start empty).

---

## 8. Local Access Model

There is **no application-level passcode or lock screen** in v2. This is a single-user local app bound to `127.0.0.1`, intended for use on the operator's own computer. Physical device security (macOS account password, FileVault, screen lock) is the security boundary, not an in-app credential system.

---

## 9. Peer Discovery Data Sources

### 9.1 — How Peer Discovery Works

Peer discovery (02-discovery-prospecting, feature #3) identifies comparable organizations and their funders. The mechanism:

1. **Seed organizations**: Hacker Dojo's hardcoded profile includes known comparable organizations in `peerOrganizations` (makerspaces, hackerspaces, community innovation hubs)
2. **Crawl phase**: OpenCode crawls each peer organization's website to identify their funders (listed in annual reports, sponsor pages, "our supporters" sections)
3. **990 analysis**: For U.S. nonprofits in the peer list, OpenCode queries the ProPublica Nonprofit API to extract their recent funders from IRS 990 filings
4. **Results**: Aggregated into a "Peer funders" list shown in the discovery view with the label "Organizations like Hacker Dojo also received funding from..."

If `integrations.propublicaApiKey` is empty, steps 3-4 are skipped and the app relies only on website-crawled peer funder references.

### 9.2 — Peer Seed Data (Hardcoded)

```yaml
peerOrganizations:
  - name: "Noisebridge"
    url: "https://noisebridge.net"
    type: "hackerspace"
  - name: "TechShop"  
    url: "https://techshop.ws"
    type: "makerspace"
  - name: "NYC Resistor"
    url: "https://nycresistor.com"
    type: "hackerspace"
  - name: "Dallas Makerspace"
    url: "https://dallasmakerspace.org"
    type: "makerspace"
  - name: "Artisan's Asylum"
    url: "https://artisansasylum.com"
    type: "makerspace"
```

The operator can add, edit, or remove peer organizations via the Sources view (they appear as a special source type `"peer"` with lower crawl frequency: 720 hours / monthly).

### 9.3 — Hidden Giving Pattern Detection

This feature (02-discovery-prospecting, feature #8) analyzes funder data from crawled sources and the ProPublica Nonprofit API:
1. OpenCode ingests funder 990 data (via ProPublica API) for known foundations
2. Analyzes giving patterns: year-over-year trends, focus area shifts, average grant sizes, co-funding patterns
3. Returns insights as structured `ResearchArtifact` evidence entries with `evidenceType: "giving_pattern"`
4. Displayed in funder detail view as "Funder Insights" cards

---

## 10. App Logging

### 10.1 — Library

**pino** v10.3.1 + **pino-roll** v4.0.0. Pino writes structured JSON to files via worker-thread transports — 5-8x faster than Winston, never blocks the event loop. `pino-roll` handles daily rotation with size limits.

```typescript
import pino from 'pino';
import { pinoRoll } from 'pino-roll';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
}, pinoRoll({
  target: '.grant-ops-data/logs/app',
  dateFormat: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: 10,
  compress: true,
}));
```

### 10.2 — Log Streams

Two log streams, both filesystem-based:

| Stream | Location | Rotation | Retention |
|---|---|---|---|
| App logs | `.grant-ops-data/logs/app.log` | Daily, max 10 files | 30 days |
| Agent session logs | `.grant-ops-data/tmp/session-{jobId}.log` | Per-job, cleanup at 30 days | 30 days |
| Error logs | `.grant-ops-data/logs/error.log` | Daily, max 10 files | 90 days |

### 10.2 — Log Format

Structured JSON lines (one object per line):

```json
{"timestamp":"2026-05-30T14:22:31.456Z","level":"info","module":"agent-loop","jobId":"job_abc123","message":"Starting draft job for grant grant_xyz","context":{"grantId":"grant_xyz","attempt":1}}
{"timestamp":"2026-05-30T14:22:35.789Z","level":"error","module":"agent-loop","jobId":"job_abc123","message":"Artifact file not found after process exit","context":{"path":".grant-ops-data/tmp/draft-job_abc123.json"}}
```

### 10.3 — Log Levels

| Level | Usage |
|---|---|
| `error` | Operation failures, crashes, data corruption |
| `warn` | Degraded states, retry attempts, stale data |
| `info` | Job start/complete, state transitions, crawler events |
| `debug` | Full prompt text, raw artifact JSON, detailed timing (off by default) |

### 10.4 — Log Access

- Operator can view logs from Settings → Logs (paginated, filterable by level)
- Failed job "View log" button opens the specific session log
- Debug mode toggleable in Settings (enables `debug` level logging)

### 10.5 — Activity Retention

`activity_events` is not an infinite audit sink. A daily maintenance job trims it to the most recent **20,000 rows** and deletes rows older than **365 days**, whichever policy removes more data. Exported CSVs remain the long-term archive mechanism.

---

## 11. Automated Backup Scheduling

### 11.1 — Auto-Backup Configuration

The operator can enable automated backups from Settings → Backup:
- **Toggle**: Enable/disable scheduled backups
- **Interval**: Every N hours (default 168 = weekly, min 24)
- **Destination**: Directory path (must be writable, validated on save)
- **Max backups**: Keep at most N backups (default 10, oldest deleted first)

### 11.2 — Backup Execution

1. Scheduler checks every 60 minutes whether `now >= nextBackupAt`
2. If due: runs `wal_checkpoint(TRUNCATE)` to flush WAL to main database file
3. Pauses new jobs, waits for active write transactions to finish, and closes all SQLite handles before any backup, restore, or destructive rebuild. After the zip is verified, the app re-opens the writer and read replicas.
4. Creates backup zip via **`adm-zip`** v0.5.17 (actively maintained; alternative to stale `jszip` v3.10.1 from 2022)
5. Computes SHA-256 hash via `node:crypto` and writes to companion `.sha256` file
6. Verifies zip can be opened and contains expected files
7. Updates `backup_schedule` table: `lastBackupAt`, `lastBackupPath`, `lastBackupChecksum`, `nextBackupAt`
8. Shows toast on completion: "Auto-backup saved to {path}"
9. If backup fails: toast error, `lastBackupVerified = 0`
10. Deletes oldest backups if count exceeds `maxBackups`

### 11.3 — Dashboard Warning

Per AC-8.2.3, the Settings view (and dashboard system status panel) show:
- "Last backup: {relative time}" (or "Never backed up")
- Warning if no backup in 7+ days
- Warning if last backup failed verification

---

## 12. Resource Monitoring

### 12.1 — Disk Space

- Checked on startup via `GET /api/health/disk`
- If `.grant-ops-data/` has < 100MB free: show warning banner
- If < 50MB free: block writes, show error overlay
- Cache cleanup runs automatically when cache > 500MB

### 12.2 — OpenCode Subprocess Limits

| Limit | Value | Configurable |
|---|---|---|
| Max concurrent subprocesses | 3 | Yes (`agent.maxConcurrentJobs`) |
| Max memory per subprocess | No enforced limit (OS-managed) | No |
| Subprocess timeout | Per job type (60–300s) | Yes, per job type |

On startup, the app scans `.grant-ops-data/tmp/session-*.log` for jobs marked `running` in the database. Any orphaned OpenCode subprocess PIDs associated with those jobs MUST be terminated and the jobs marked `failed` with error `"App terminated during operation"`.

### 12.3 — Database Size

- WAL auto-checkpoint after 1000 write transactions (AC-14.7.3)
- Periodic `PRAGMA optimize` on startup
- Database file size displayed in Settings → System

---

## 13. App Identity & Branding

### 13.1 — App Metadata

- **Name**: "Hacker Dojo Grant Ops"
- **Version**: displayed in sidebar footer
- **Window title**: "Grant Ops — Hacker Dojo" (or "{view name} — Grant Ops")

### 13.2 — Favicon & App Icon

- Favicon: Gold `//` glyph on dark background (referencing the Hacker Dojo logo mark)
- App icon: same mark at 512×512 for taskbar/dock
- No Open Graph or social meta tags needed — this is a local app, not a public website

### 13.3 — No Web Serving

The app runs exclusively on `localhost` (AC-12.1.1). It is:
- Not deployed to any public URL
- Not accessible from other machines on the network
- Not packaged with any CDN or external web service
- The Next.js server binds to `127.0.0.1` only
- There is no production deployment target — users run `pnpm dev` locally

### 13.4 — Distribution

- Source code distributed via GitHub
- Users clone the repo and run `pnpm install && pnpm dev`
- Optionally, a pre-built DMG or shell script installer can be created for non-technical operators, but this is out of scope for v2
- The `.grant-ops-data/` directory is created automatically on first run — no installer needed

---

## Implementation Checklist

- [ ] Define all Zod schemas for API request/response validation
- [ ] Implement all API routes (1.1–1.20)
- [ ] Create SQLite database with all tables, indexes, and FTS
- [ ] Implement seed data insertion on first run
- [ ] Implement document upload pipeline with atomic writes
- [ ] Implement text extraction for PDF/DOCX
- [ ] Implement grant FTS5 search with filter combination
- [ ] Build toast notification system
- [ ] Build in-app notification center (sidebar badge + drawer)
- [ ] Implement CSV/XLSX budget import parser
- [ ] Implement settings persistence and UI
- [ ] Implement custom tracker fields
- [ ] Implement peer discovery data model and crawl
- [ ] Implement structured JSON logging
- [ ] Implement log viewer in Settings
- [ ] Implement automated backup scheduler
- [ ] Implement disk space health check
- [ ] Implement WAL checkpoint trigger
- [ ] Create favicon and app icon assets
- [ ] Wire all views to API routes (replace any direct DB access from frontend)
