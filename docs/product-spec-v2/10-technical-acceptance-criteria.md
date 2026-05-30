# 10 — Technical Acceptance Criteria

> **Purpose**: Unambiguous, testable acceptance criteria for every subsystem.  
> **No hand-waving**. Every criterion is specific enough to write a test case from.  
> **Covers**: agent loop, artifacts, async UI, crawler, persistence, matching, drafting, submission, post-award, backup, accessibility.

---

## 1. OpenCode Agent Loop

### 1.1 — Artifact Contract

**AC-1.1.1** — When the app spawns an OpenCode process for any job type (research, draft, crawl, match, extract), the prompt sent to OpenCode MUST include:
- The exact file path where the artifact JSON must be written (e.g., `.grant-ops-data/tmp/research-{jobId}.json`)
- The complete JSON schema the artifact must conform to
- An explicit instruction: "Write ONLY valid JSON to this path. No markdown, no code fences, no explanatory text in the file."
- The `ARTIFACT_PATH` environment variable set to the artifact file path

**AC-1.1.2** — The app MUST NOT parse OpenCode's stdout as a result. All results MUST be read from the artifact file written to disk.

**AC-1.1.3** — If the artifact file does not exist after OpenCode exits (including timeout), the job status MUST be set to `"retrying"` (if retries remain) or `"failed"` with error message `"Agent did not produce an artifact file at {path}"`.

**AC-1.1.4** — The app MUST retry failed jobs up to 3 times. Each retry MUST include the specific failure reason from the previous attempt in the prompt (e.g., "Previous attempt failed: invalid JSON at line 42" or "Previous attempt failed: missing required field 'grants'").

### 1.2 — JSON Validation

**AC-1.2.1** — After reading the artifact file, the app MUST attempt `JSON.parse()`. If parsing throws, the job enters retry (if attempts remain) with error `"Invalid JSON: {parseError.message}"`.

**AC-1.2.2** — After successful parse, the app MUST validate against the corresponding Zod schema. If validation fails with issues `[{path: ["grants", 0, "title"], message: "Required"}]`, the job enters retry with error `"Schema validation failed: grants.0.title: Required"`.

**AC-1.2.3** — The app MUST NOT ingest partially valid data. If validation fails, no database writes occur. The tmp artifact file is preserved for debugging.

**AC-1.2.4** — After 3 failed attempts (any failure mode), the job status MUST be `"failed"`, the error message MUST include all unique failure reasons across attempts, and the user MUST see an actionable error (e.g., "Draft generation failed after 3 attempts. The agent was unable to produce valid output. You can retry manually or check the session log at .grant-ops-data/tmp/session-{jobId}.log").

### 1.3 — Artifact Ingestion

**AC-1.3.1** — On successful validation, the verified artifact MUST be:
- Copied to `.grant-ops-data/artifacts/{jobType}/{jobId}.json` (immutable record)
- Ingested into SQLite with all fields matching the schema exactly
- The tmp file at `.grant-ops-data/tmp/{jobType}-{jobId}.json` MAY be deleted after 24 hours

**AC-1.3.2** — Ingestion MUST be transactional. If any database write fails during ingestion, the entire job MUST be marked `"failed"`, no partial data persists, and the artifact file is preserved.

### 1.4 — Progress Reporting

**AC-1.4.1** — Every job MUST report progress through the `/api/jobs/{jobId}` endpoint with these fields:
```typescript
{
  status: "queued" | "running" | "verifying" | "retrying" | "completed" | "failed" | "cancelled";
  progress: number;       // 0-100 integer
  stage: string;          // human-readable stage name
  retryCount: number;     // current attempt number (1-3)
  maxRetries: number;     // always 3
  errorMessage?: string;  // present only on failed/retrying
}
```

**AC-1.4.2** — Progress MUST transition only through stages the controller can directly observe. Until OpenCode emits structured progress, the required stages are:

| Job Type | Required Stages (in order) |
|---|---|
| research | queued(0) → preparing(5) → running(50) → verifying(90) → completed(100) |
| draft | queued(0) → preparing(5) → running(50) → verifying(90) → completed(100) |
| crawl | queued(0) → preparing(5) → running(50) → verifying(90) → completed(100) |
| match | queued(0) → preparing(5) → running(50) → verifying(90) → completed(100) |
| extract | queued(0) → preparing(5) → running(50) → verifying(90) → completed(100) |

**AC-1.4.3** — The `/api/jobs/{jobId}` endpoint MUST return progress within 100ms. The frontend MUST poll every 2 seconds while a job has status `"running"` or `"verifying"` or `"retrying"`.

**AC-1.4.4** — If the frontend has not received a progress update for 30 seconds while a job is `"running"`, it MUST show a warning: "The agent appears to be taking longer than expected. You can continue waiting or cancel."

### 1.5 — Cancellation

**AC-1.5.1** — `POST /api/jobs/{jobId}/cancel` MUST:
- Send SIGTERM to the OpenCode subprocess
- Wait up to 5 seconds for graceful shutdown
- Send SIGKILL if still running after 5 seconds
- Set job status to `"cancelled"`
- Not ingest any partial artifact
- Clean up the tmp artifact file

**AC-1.5.2** — Cancelled jobs MUST be retryable. A cancelled job's retry count is preserved from before cancellation.

### 1.6 — Timeout

**AC-1.6.1** — Each job type MUST have a configurable timeout:

| Job Type | Default Timeout |
|---|---|
| research | 120 seconds |
| draft | 300 seconds |
| crawl | 180 seconds |
| match | 60 seconds |
| extract | 60 seconds |

**AC-1.6.2** — On timeout, the OpenCode subprocess MUST be killed (SIGTERM → 5s → SIGKILL). The job enters retry (if attempts remain) with error `"Operation timed out after {timeout}s"`.

---

## 2. Async UI Representation

### 2.1 — JobProgress Component

**AC-2.1.1** — Every button that triggers an async AI operation MUST render a `<JobProgress>` component after click, replacing or overlaying the button area. The component MUST show:
- Current stage as human-readable text (e.g., "Searching for grants...")
- Progress bar: determinate (filled to `progress`%) when `progress > 0`, indeterminate animation when `progress === 0`
- Retry count badge if `retryCount > 0` (e.g., "Attempt 2 of 3")
- Cancel button (always visible while status is `"running"` or `"retrying"` or `"verifying"`)
- Error message with retry button when status is `"failed"`

**AC-2.1.2** — The progress bar MUST update visually within 500ms of the API returning new progress data. No polling lag visible to the user beyond 2 seconds.

**AC-2.1.3** — When a job completes (`"completed"`), the component MUST:
- Show a brief success animation (checkmark or green flash, ≤ 500ms)
- Auto-dismiss after 3 seconds (unless the result requires user review)
- Trigger data refresh for the relevant view (e.g., reload grants list after research completes)

**AC-2.1.4** — When a job fails after all retries (`"failed"`), the component MUST:
- Show the error message in red
- Show a "Retry" button
- Show a "View log" link that opens `.grant-ops-data/tmp/session-{jobId}.log`
- NOT auto-dismiss

**AC-2.1.5** — Multiple jobs MAY run simultaneously. Each job gets its own JobProgress instance. The sidebar MUST show a count of active jobs: "⚙ Jobs (2)".

### 2.2 — No UI Freezing

**AC-2.2.1** — All OpenCode subprocess spawning MUST happen on the server side (Next.js API route with Node.js `child_process`). The frontend MUST communicate only via HTTP fetch/polling. At no point must the frontend event loop be blocked by agent operations.

**AC-2.2.2** — While a job is running, the user MUST be able to:
- Navigate to other views (Dashboard, Pipeline, Settings)
- Open and read grant details
- Edit non-locked data
- Trigger additional jobs (if resources allow)

**AC-2.2.3** — If the user navigates away from the view that triggered a job, the JobProgress MUST persist as a floating mini-bar at the bottom of the screen showing: job type icon, stage text, progress bar, cancel button.

---

## 3. Tmp Directory & Cache Management

### 3.1 — Directory Structure

**AC-3.1.1** — The following directory structure MUST exist and be created on first run if missing:
```
.grant-ops-data/
  tmp/                          # Agent working directory
  tmp/.cache/                   # Agent cache
  artifacts/                    # Verified, persisted artifacts
  artifacts/research/
  artifacts/drafts/
  artifacts/matches/
  artifacts/extracts/
  artifacts/crawls/
```

**AC-3.1.2** — The app MUST create `.grant-ops-data/tmp/` if it does not exist, with permissions 0o700 (owner read/write/execute only).

### 3.2 — Cleanup

**AC-3.2.1** — On app startup, a cleanup routine MUST run that:
- Deletes all `.grant-ops-data/tmp/*.json` files older than 24 hours (completed or cancelled job artifacts)
- Deletes all `.grant-ops-data/tmp/*.log` files older than 30 days (session logs)
- Deletes all `.grant-ops-data/tmp/.cache/` contents older than 7 days
- Does NOT touch `.grant-ops-data/artifacts/` (persisted verified artifacts)

**AC-3.2.2** — If `.grant-ops-data/tmp/.cache/` exceeds 500MB total, the cleanup routine MUST delete oldest files first until total size is under 500MB.

**AC-3.2.3** — A periodic cleanup timer MUST run every 6 hours while the app is running. The cleanup MUST NOT block the main thread and MUST NOT delete files currently being written by an active job.

**AC-3.2.4** — Failed job artifacts (status `"failed"`) MUST be preserved in tmp/ for debugging. They follow the same 24-hour deletion rule as completed artifacts.

---

## 4. Crawler

### 4.1 — Crawl Execution

**AC-4.1.1** — The crawler MUST use the agent loop pattern (Section 1). A crawl job spawns OpenCode with instructions to crawl the specified source URL(s) and write results to the artifact file.

**AC-4.1.2** — The crawler prompt MUST include:
- Source URL(s) to crawl
- The Hacker Dojo organization profile (for context-aware extraction)
- Instructions to extract: grant title, funder name, award amount, deadline, eligibility, requirements, URL
- The artifact schema for crawl results

**AC-4.1.3** — Crawl results MUST be deduplicated against existing grants before ingestion. Two grants are duplicates if they have the same `title` (case-insensitive, trimmed) AND same `funder` (case-insensitive, trimmed). Duplicates are logged but not ingested.

**AC-4.1.4** — Crawl jobs MUST respect `crawl.requestDelayMs`, `crawl.respectRobotsTxt`, and `crawl.userAgent`. The default request delay is 2000ms between requests to the same source.

**AC-4.1.5** — Deleting a source MUST NOT delete linked grant records. Instead, `grants.sourceId` is set to `NULL` and the grant remains available for manual review/history.

### 4.2 — Crawl Scheduling

**AC-4.2.1** — Each source MUST have a configurable `intervalHours`. Default intervals:
- grants.gov: 24 hours
- nsf.gov: 48 hours
- Foundation/corporate websites: 168 hours (weekly)

**AC-4.2.2** — The scheduler MUST check every 60 seconds whether any source is due for crawling (`now - lastCrawledAt >= intervalHours`). Due sources are queued as crawl jobs and processed sequentially (max 1 concurrent crawl).

**AC-4.2.3** — Manual crawl (user clicks "Refresh crawl") MUST bypass the scheduler and queue immediately. If a crawl is already running for that source, the manual request is ignored with a message: "Crawl already in progress for {source}".

**AC-4.2.4** — Every crawl request MUST create a `crawl_runs` record linked to both the `sourceId` and the spawned `agent_job`. `GET /api/sources/{id}/crawls` MUST read from that persisted history.

### 4.3 — Crawl Status Visibility

**AC-4.3.1** — The dashboard MUST show:
- Crawl freshness indicator: "Data fresh" (< 24h), "Data may be stale" (24h–7d), "Data is very stale" (> 7d), "Crawl failed", "No crawls yet"
- Per-source staleness: each source name + freshness tier + last crawl time
- Crawl retry button for failed crawls

**AC-4.3.2** — When a crawl is running, the dashboard MUST show the JobProgress component for the crawl job.

**AC-4.3.3** — The Sources view MUST show per-source crawl state:
- `never-crawled`: "Not yet crawled"
- `queued`: "Queued for crawling"
- `running`: "Crawling..." with progress bar
- `succeeded`: "Last crawled {relative time}" with grant count
- `partially-failed`: "Partial results — {n} pages failed"
- `failed`: "Crawl failed — {error message}"

---

## 5. Matching & Scoring

### 5.1 — Fit Score Calculation

**AC-5.1.1** — Each grant matched from a crawl MUST receive a fit score (0–100) calculated by OpenCode and validated against the MatchArtifact schema. The score MUST include breakdown into 5 dimensions:
- `missionAlignment` (0–100)
- `geographicFocus` (0–100)
- `programTrackrecord` (0–100)
- `budgetCapacity` (0–100)
- `partnershipReadiness` (0–100)

**AC-5.1.2** — The match prompt sent to OpenCode MUST include:
- Full Hacker Dojo organization profile
- Full grant text/details
- Instructions to score each dimension with justification
- The MatchArtifact schema

**AC-5.1.3** — Scores MUST be recalculated when the organization profile changes (e.g., new program area added, mission updated). This recalculation MUST happen as a background match job, not blocking the UI.

### 5.2 — Score Display

**AC-5.2.1** — The Discovery view MUST show each grant's fit score as a number (e.g., "92") with a color-coded bar:
- Score ≥ 85: green bar, full width proportional to score
- Score 70–84: amber/gold bar
- Score < 70: muted/gray bar

**AC-5.2.2** — The grant detail drawer MUST show the 5-dimension breakdown with horizontal bars and numeric scores for each dimension.

**AC-5.2.3** — The drawer MUST show the match rationale: 1–3 sentences explaining why the score was assigned, referencing specific Hacker Dojo attributes (e.g., "Strong alignment with your AI literacy program and Bay Area focus").

---

## 6. Draft Generation

### 6.1 — Draft Execution

**AC-6.1.1** — Draft generation MUST use the agent loop pattern. The prompt MUST include:
- The specific grant details (title, funder, requirements, deadline)
- The full Hacker Dojo organization profile
- All uploaded reference documents marked as `"canonical"` or `"draft-only"` (NOT `"restricted"`)
- Any past approved drafts for similar grants (institutional memory)
- Any revision instructions from the user
- The DraftArtifact schema

**AC-6.1.2** — The generated draft MUST include, for each section:
- `sectionTitle`: e.g., "Project Vision", "Why Hacker Dojo", "Proposed Activities"
- `content`: the generated text
- `groundingSources`: array of document IDs or URLs that support claims in this section
- `isGrounded`: boolean — `true` if at least one source is cited, `false` if no sources found

**AC-6.1.3** — Draft versioning: each generated draft receives a new version number. The previous version is preserved. At no point may a draft generation overwrite an existing version without creating a new version record.

### 6.2 — Draft Display

**AC-6.2.1** — The draft preview MUST display each section with:
- Section title as a heading
- Content as formatted text (preserving paragraphs and emphasis)
- Grounding status badge: 🟢 "Grounded" (6+ sources) / 🟡 "Weakly grounded" (1–5 sources) / 🔴 "Ungrounded" (0 sources)
- Click to expand grounding sources list

**AC-6.2.2** — A side-by-side diff view MUST be available to compare any two draft versions. Added text is green, removed text is red, unchanged text is dimmed.

### 6.3 — Human Approval

**AC-6.3.1** — The "Approve & Lock" button MUST be disabled if any section has `isGrounded: false` and the user has not explicitly acknowledged the gap (via a checkbox: "I acknowledge this section lacks grounding evidence").

**AC-6.3.2** — On approval, the draft MUST be:
- Locked (no further edits without explicit "Reopen" action)
- Recorded with approver identity, timestamp, and approval notes in the audit log
- Version number frozen

**AC-6.3.3** — Reopening a locked draft MUST:
- Require a reason (text input)
- Preserve the locked version
- Create a new editable working copy with incremented version number
- Log the reopen action in the audit log

---

## 7. Pipeline State Management

### 7.1 — State Transitions

**AC-7.1.1** — Only these transitions are valid:

| From | Valid To |
|---|---|
| matched | draft, closed, archived |
| draft | review, closed |
| review | draft (revision), approved, closed |
| approved | submission-ready, closed |
| submission-ready | submitted, closed |
| submitted | follow-up, awarded, declined |
| follow-up | awarded, declined, submitted |
| awarded | closed |
| declined | closed, archived |
| closed | archived |
| archived | (terminal) |

**AC-7.1.2** — Invalid transitions MUST be rejected by the API with HTTP 400 and message `"Cannot transition from {fromState} to {toState}"`.

**AC-7.1.3** — Every state transition MUST be logged: `{grantId, fromState, toState, timestamp, actor: "user", reason?}`.

### 7.2 — Submission Blocking

**AC-7.2.1** — A grant CANNOT transition to `"submission-ready"` if:
- Any task with `blockSubmission: true` is not completed
- The draft is not approved
- Required profile fields are missing (legal name, EIN, mission)

**AC-7.2.2** — The API MUST return the specific blocking reasons when rejecting a transition to `"submission-ready"`:
```json
{
  "error": "Cannot transition to submission-ready",
  "blockingReasons": [
    "Task 'Upload IRS determination letter' is not completed",
    "Draft has not been approved"
  ]
}
```

---

## 8. Persistence & Backup

### 8.1 — SQLite Integrity

**AC-8.1.1** — All writes to SQLite MUST use WAL mode (Write-Ahead Logging). The database file MUST be at `.grant-ops-data/grant-ops.sqlite`.

**AC-8.1.2** — On startup, the app MUST run `PRAGMA quick_check`. If it fails, the app MUST fall back to `PRAGMA integrity_check`. If either check fails, the app MUST:
- Show a blocking error: "Database integrity check failed. Your data may be corrupted."
- Offer a restore-from-backup option
- NOT allow any writes until resolved

**AC-8.1.3** — Before any operator-initiated destructive schema rebuild or restore, the app MUST first run `PRAGMA wal_checkpoint(TRUNCATE)` and then create an automatic backup. That backup MUST include the SQLite database file plus all files in `.grant-ops-data/documents/` and `.grant-ops-data/artifacts/`, packaged as `.grant-ops-data/backups/grant-ops-{ISO timestamp}.zip`.

### 8.2 — Backup & Restore

**AC-8.2.1** — Manual backup MUST:
- Copy the SQLite database file
- Copy all files in `.grant-ops-data/documents/`
- Copy all files in `.grant-ops-data/artifacts/`
- Package everything into a single `.zip` file at a user-chosen location
- Verify the zip file integrity (can be opened, contains all expected files)

**AC-8.2.2** — Restore MUST:
- Validate that the zip file contains a valid SQLite database (runs `PRAGMA integrity_check` on the restored DB before replacing current)
- Warn if the backup is older than 7 days: "This backup is {n} days old. Restoring will replace all current data."
- Require explicit confirmation before proceeding
- Create a backup of current state before overwriting ("pre-restore backup")
- Pause new jobs, wait for running write transactions to finish, close all SQLite handles, perform the restore, then re-open handles only after integrity checks pass

**AC-8.2.3** — The Settings view MUST show:
- "Last backup: {relative time}" or "Never backed up"
- "Last backup verification: {outcome}" (from the backup manifest)
- Warning banner if no backup in 7+ days: "⚠️ No recent backup. We recommend backing up weekly."

---

## 9. Accessibility

### 9.1 — Keyboard Navigation

**AC-9.1.1** — Every interactive element MUST be reachable via Tab. Tab order MUST follow visual order (left-to-right, top-to-bottom).

**AC-9.1.2** — The sidebar navigation MUST be fully keyboard operable: Arrow Up/Down to move between items, Enter/Space to select. The currently focused nav item MUST have a visible focus ring.

**AC-9.1.3** — The grant detail drawer MUST be closable with Escape. When the drawer is open, Tab MUST cycle only within drawer elements (focus trap).

**AC-9.1.4** — The pipeline board view MUST support keyboard navigation between columns with Arrow Left/Right, and between cards with Arrow Up/Down.

### 9.2 — Screen Reader

**AC-9.2.1** — All dynamic content changes (job status, notifications, crawl completion) MUST use `aria-live` regions so screen readers announce them.

**AC-9.2.2** — Progress bars MUST have `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label`.

**AC-9.2.3** — All icons MUST have `aria-hidden="true"` and be accompanied by visible text or `aria-label`. No icon-only buttons without accessible names.

### 9.3 — Focus Management

**AC-9.3.1** — After closing the grant drawer, focus MUST return to the element that opened it (the grant row or card that was clicked).

**AC-9.3.2** — After completing a job, focus MUST NOT move unexpectedly. The JobProgress component dismisses but focus stays on the last interacted element.

**AC-9.3.3** — The skip-to-content link MUST be the first focusable element on the page. When activated, it MUST move focus to `<main id="main-content">`.

---

## 10. Error Handling & Resilience

### 10.1 — Graceful Degradation

**AC-10.1.1** — If OpenCode is not installed or not on PATH:
- The app MUST start and show all local data (grants, pipeline, tasks)
- AI features MUST show "AI features unavailable — OpenCode not detected"
- The user MUST still be able to browse, edit, review, and track grants manually

**AC-10.1.2** — If the SQLite database cannot be opened:
- The app MUST show a blocking error screen with the exact error message
- The user MUST NOT be able to navigate to any view (all data-dependent views are blocked)
- A "Re-run health check" button MUST be available

**AC-10.1.3** — If the crawl scheduler encounters a persistent failure (3+ consecutive failures for the same source):
- That source MUST be flagged with `sourceCrawlState: "failed"`
- The dashboard MUST show "Crawl failed for {source}" with the error message
- Other sources MUST continue crawling normally
- The user MUST be able to manually trigger a retry

### 10.2 — Data Integrity

**AC-10.2.1** — If the app crashes or is force-quit during a database write, on next startup:
- The WAL file MUST be automatically checkpointed (SQLite WAL recovery)
- Any in-progress jobs MUST be marked `"failed"` with error "App terminated during operation"
- No corrupted or partial records MUST exist in the database

**AC-10.2.2** — Document uploads MUST be atomic: the file is written to a temp path first, then renamed to the final path only after successful database record creation. If the database write fails, the temp file is deleted.

**AC-10.2.3** — On startup, any agent job still marked `running` or `verifying` from a previous process crash MUST be marked `failed`. Any orphaned matching OpenCode subprocess MUST be terminated before new jobs are accepted.

**AC-10.2.4** — The job record MUST store the spawned subprocess PID and process start time so orphan detection can be implemented after a crash.

---

## 11. Performance

**AC-11.1.1** — The dashboard MUST render within 2 seconds on a dataset of:
- 500 grants
- 50 sources
- 100 tasks
- 100 notifications

**AC-11.1.2** — The discovery view MUST filter and sort 500 grants within 200ms of user input (search text or filter change).

**AC-11.1.3** — The pipeline board view MUST render within 1 second for 100 active grants across 11 columns.

**AC-11.1.4** — All API endpoints (except AI job endpoints) MUST respond within 500ms for the dataset sizes above.

---

## 12. Security (Local App)

**AC-12.1.1** — The app MUST NOT expose any API endpoints on network interfaces other than `localhost` (127.0.0.1). The Next.js server MUST bind to `localhost` only.

**AC-12.1.2** — The passcode lock feature MUST use **argon2id** as the primary hash algorithm. The hash MUST be stored in the `settings` table under `passcode.hash`. If the native `argon2` package fails to compile on macOS, `bcryptjs` with cost factor 12 MAY be used as a fallback. Plain-text passcodes MUST never be stored.

**AC-12.1.3** — All application-managed persistent reads and writes MUST be restricted to within `.grant-ops-data/`. The only exceptions are operator-initiated backup/restore import-export targets (for example a user-selected `.zip` destination or source). The API MUST reject any path containing `..` or arbitrary absolute paths unless it is an explicit operator-selected backup/restore/export path.

**AC-12.1.4** — When passcode lock is enabled and the app is locked, all protected page requests and API routes MUST reject access until unlock. Protected API routes MUST return HTTP 423 with the standard error contract. Only `/api/passcode/status`, `/api/passcode/verify`, and `/api/health*` remain accessible while locked.

---

## 13. Testing Gates

**AC-13.1.1** — Before any release, these tests MUST pass:
- `pnpm typecheck` — zero errors
- `pnpm lint` — zero errors, zero warnings
- `pnpm test` — all unit and integration tests pass
- `pnpm test:e2e` — all end-to-end tests pass

**AC-13.2.1** — The agent loop MUST have unit tests that mock the OpenCode subprocess and test:
- Successful artifact generation and ingestion
- Invalid JSON → retry → success on 2nd attempt
- Invalid JSON → retry → retry → failure on 3rd attempt
- Timeout → retry
- Cancellation mid-operation
- Missing artifact file after process exit
- Schema validation failure with specific error propagation

**AC-13.2.2** — The progress polling system MUST have integration tests that verify:
- Progress updates are received within 2 seconds of state change
- UI updates within 500ms of receiving new progress data
- Job completion triggers data refresh
- Job failure shows error with retry button

---

## 14. Integration & End-to-End Workflow Testing

### 14.1 — Complete Discovery → Submission Workflow

**AC-14.1.1** — An integration test MUST verify the full workflow end-to-end:
1. Source is added (via API)
2. Crawl is triggered → agent mocked to return valid CrawlArtifact
3. Grants are ingested into SQLite
4. Grants appear in discovery view
5. A grant is added to pipeline
6. Draft is triggered → agent mocked to return valid DraftArtifact
7. Draft is rendered in the grant detail drawer
8. Draft is approved
9. Submission readiness is checked — blocks if tasks incomplete
10. Tasks are completed
11. Grant transitions to submitted
12. Follow-up tasks are auto-created
13. Award letter is uploaded → extract agent mocked
14. Award data is ingested → spend-down tracking created

**AC-14.1.2** — The full workflow test MUST complete in under 30 seconds (all agent calls mocked).

### 14.2 — Agent Failure Propagation

**AC-14.2.1** — A test MUST verify that when the agent returns invalid JSON on attempt 1, the retry prompt includes the specific parse error.

**AC-14.2.2** — A test MUST verify that when the agent returns valid JSON that fails schema validation, the retry prompt includes the specific Zod error paths and messages.

**AC-14.2.3** — A test MUST verify that after 3 failed attempts, the job status is `"failed"`, the error message includes all 3 failure reasons, and zero database records were created.

**AC-14.2.4** — A test MUST verify that a previously failed job can be manually retried via the UI and succeeds on retry.

### 14.3 — Concurrent Job Handling

**AC-14.3.1** — The system MUST support at least 3 concurrent OpenCode subprocesses (one research, one draft, one crawl) without interference. Each subprocess writes to a distinct artifact path.

**AC-14.3.2** — A test MUST verify that concurrent jobs do not share or overwrite each other's artifact files:
- Job A writes to `tmp/research-jobA.json`
- Job B writes to `tmp/draft-jobB.json`
- Both complete independently
- Both artifacts are ingested into correct database tables

**AC-14.3.3** — A test MUST verify that cancelling one job does not affect other running jobs. The cancelled job's subprocess is killed; other subprocesses continue.

**AC-14.3.4** — The `/api/jobs` endpoint MUST return all active jobs. The UI MUST show a separate JobProgress component per active job. The sidebar badge MUST show the correct active job count.

### 14.4 — Polling Edge Cases

**AC-14.4.1** — If the `/api/jobs/{jobId}` endpoint returns a 500 error during polling, the UI MUST silently retry on the next poll interval (2s later). After 3 consecutive poll failures, the JobProgress MUST show: "Connection lost — retrying..." with a manual "Retry now" button.

**AC-14.4.2** — If the job completes while the user is viewing a different screen, a toast notification MUST appear: "✅ {jobType} completed" with a link back to the relevant view.

**AC-14.4.3** — If the browser tab is backgrounded during a job, polling MUST continue. When the tab is re-focused, the UI MUST immediately fetch the latest job status rather than waiting for the next poll interval.

### 14.5 — Filesystem Edge Cases

**AC-14.5.1** — If the `tmp/` directory is not writable (disk full, permissions), the agent loop MUST catch the write error before spawning the subprocess and fail immediately with: "Cannot write to tmp directory: {error}". No subprocess is spawned.

**AC-14.5.2** — If the `artifacts/` persist directory is not writable, ingestion MUST fail with: "Cannot persist artifact: {error}". The tmp artifact file is preserved. The job status is `"failed"`.

**AC-14.5.3** — If the SQLite database is locked (another process has it open), writes MUST retry up to 3 times with 100ms backoff. If still locked, the operation fails with: "Database is locked. Close other applications using .grant-ops-data/ and retry."

**AC-14.5.4** — The cleanup routine (Section 3.2) MUST NOT delete files that are currently open for writing by an active job. It MUST use file age (mtime), not creation time, for age-based deletion.

### 14.6 — Document Upload Validation Chain

**AC-14.6.1** — Document upload MUST validate:
1. File exists and is readable
2. File size ≤ 50MB (configurable)
3. File extension is in the allowed list: `.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.csv`, `.txt`, `.png`, `.jpg`, `.jpeg`
4. MIME type matches the extension (server-side check, not client-side)
5. File is written atomically: temp path → rename to final path after DB record created

**AC-14.6.2** — If any validation step fails, the upload MUST be rejected with a specific error message naming which check failed. No partial file or database record is created.

**AC-14.6.3** — Document extraction (text extraction for AI grounding) MUST handle:
- Successfully extracted text → stored in `extractedText`, status `"extracted"`
- Unsupported format → stored as binary only, status `"stored_unparsed"`
- Corrupt file → status `"failed"` with `extractionError`
- Empty file (0 bytes) → rejected at upload time with "File is empty"

### 14.7 — SQLite WAL & Checkpoint Edge Cases

**AC-14.7.1** — On startup, if a WAL file exists from a previous crash, the app MUST run `PRAGMA wal_checkpoint(TRUNCATE)` before any reads. This recovers committed-but-not-checkpointed transactions.

**AC-14.7.2** — If checkpoint fails (e.g., WAL file is corrupt), the app MUST:
- Show a blocking error: "Database recovery failed. The write-ahead log may be corrupted."
- NOT delete the WAL file (preserves data for manual recovery)
- Offer: "Restore from backup" as the recovery path

**AC-14.7.3** — After 1000 write transactions, the app MUST trigger an automatic WAL checkpoint to prevent unbounded WAL file growth.

### 14.8 — Schema Initialization and Forward Migration Testing

**AC-14.8.1** — On a clean machine with no `.grant-ops-data/grant-ops.sqlite`, startup MUST create the full schema, all indexes, and all FTS5 tables in a single transaction.

**AC-14.8.2** — If schema initialization fails mid-way, the database file MUST be deleted and recreated on the next startup attempt. No partial schema state may persist.

**AC-14.8.3** — For any released v2 build after the initial schema, forward-only migration scripts MUST be applied in order, each inside a transaction.

**AC-14.8.4** — Before any migration or operator-initiated destructive schema rebuild, the app MUST create an automatic backup (file copy of the SQLite database). If the migration or rebuild fails, the user is directed to this backup.

### 14.9 — OpenCode Subprocess Lifecycle

**AC-14.9.1** — When spawning OpenCode, the app MUST:
- Set a timeout timer (configurable per job type)
- Capture stdout and stderr to `.grant-ops-data/tmp/session-{jobId}.log`
- Set the `ARTIFACT_PATH` environment variable
- Pass the prompt via stdin or a temp prompt file (never via command-line argument if prompt > 128KB)

**AC-14.9.2** — On subprocess exit, the app MUST check the exit code. Exit code 0 means the agent believes it succeeded (artifact may still be invalid). Non-zero exit code means the agent reported failure. In both cases, the app MUST still check for and validate the artifact file.

**AC-14.9.3** — If the subprocess is killed externally (SIGKILL from OS, user kills process), the job MUST be marked `"failed"` with error: "Agent process was terminated unexpectedly". The tmp artifact file (if any) is preserved.

**AC-14.9.4** — The app MUST limit concurrent OpenCode subprocesses to a configurable maximum (default: 3). If a 4th job is queued, it stays `"queued"` until a slot opens.

### 14.10 — API Error Response Contract

**AC-14.10.1** — Every API error response MUST follow this shape:
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}  // optional, type-specific
}
```

**AC-14.10.2** — Machine-readable error codes MUST include:
- `AGENT_ARTIFACT_NOT_FOUND` — artifact file missing after OpenCode exit
- `AGENT_INVALID_JSON` — artifact file contains unparseable JSON
- `AGENT_SCHEMA_MISMATCH` — Zod validation failed
- `AGENT_TIMEOUT` — subprocess timed out
- `AGENT_MAX_RETRIES` — all 3 attempts failed
- `DB_INTEGRITY_ERROR` — SQLite integrity check failed
- `DB_LOCKED` — database is locked
- `FILE_NOT_FOUND` — referenced file doesn't exist
- `FILE_TOO_LARGE` — upload exceeds size limit
- `FILE_UNSUPPORTED_TYPE` — upload has unsupported extension
- `INVALID_STATE_TRANSITION` — pipeline state change not allowed
- `SUBMISSION_BLOCKED` — tasks blocking submission
- `STORAGE_UNAVAILABLE` — can't read/write to data directory

**AC-14.10.3** — The frontend MUST handle each error code with a specific user-facing message and recovery action, not a generic "Something went wrong."

### 14.11 — Autosave & Draft Protection

**AC-14.11.1** — Long-form text fields (draft editor, notes, grant descriptions) MUST autosave every 30 seconds of inactivity (user stopped typing). The autosave MUST write to localStorage as a recovery buffer, then to the server on next explicit save.

**AC-14.11.2** — If the user navigates away from a page with unsaved changes, a `beforeunload` handler MUST trigger: "You have unsaved changes. Leave anyway?" This MUST NOT trigger if all changes are autosaved.

**AC-14.11.3** — On app restart after a crash, the app MUST check localStorage for unsaved draft recovery buffers. If found, the user is prompted: "Unsaved draft found from {timestamp}. Restore it?"

### 14.12 — End-to-End Test Requirements

**AC-14.12.1** — E2E tests MUST cover at minimum:
- App launches and shows dashboard within 3 seconds
- Health check returns all-green on clean setup
- Source can be added, crawl triggered, results displayed
- Grant can be moved through pipeline: matched → draft → review → approved → submitted
- Manual grant intake creates a visible grant record
- Draft can be generated, reviewed, revised, approved
- Submission is blocked when required tasks are incomplete
- Backup creates a valid .zip file
- Restore from backup recovers all grants and documents
- Calendar view shows correct deadlines
- All views are keyboard-navigable (Tab, Arrow keys, Enter, Escape)
- Screen reader announces dynamic content changes

**AC-14.12.2** — E2E tests MUST mock the OpenCode subprocess (never call real OpenCode in CI). The mock MUST simulate: success, invalid JSON, timeout, and process crash scenarios.

---

## 15. Prompt Effectiveness & Artifact Quality

> **Critical**: The agent loop typechecks JSON structure, but structure alone doesn't mean the artifact is useful. This section ensures prompts produce **real, substantive results** — not empty arrays, placeholder text, or "nothing found."

### 15.1 — Prompt Smoke Testing (Manual, Pre-Release)

**AC-15.1.1** — Before every release, a human MUST run the smoke test suite against real OpenCode (no mocks). The smoke test covers every prompt type against real sources and verifies artifact quality, not just validity. Smoke test results are documented in `.grant-ops-data/smoke-test-results/{version}.json`.

**AC-15.1.2** — The smoke test is NOT part of the automated test suite (it consumes AI tokens and takes minutes). But it IS a hard release gate — the release cannot ship if any smoke test scenario fails.

### 15.2 — Research/Crawl Prompt Quality

**AC-15.2.1** — When the research prompt is sent against a known-good source (e.g., grants.gov or nsf.gov), the resulting `ResearchArtifact` MUST:
- Contain at least 1 grant (not an empty `grants` array)
- Each grant MUST have a non-empty `title` and `funder`
- At least one grant MUST have a non-empty `award`, `deadline`, or `eligibility` field
- The `rationale` field MUST explain what was found in plain language
- If no grants were found, the `errors` array MUST explain why (e.g., "Source returned no results for search criteria", "Source requires authentication", "Source structure changed")

**AC-15.2.2** — The research prompt MUST be structured such that OpenCode understands:
- What source(s) to search
- What to extract (title, funder, award, deadline, eligibility, requirements, URL)
- How to format the output (the exact JSON schema)
- What constitutes "no results" vs "failure to search"
- That partial results (some grants found, some pages failed) are acceptable and should be reported

**AC-15.2.3** — Smoke test scenario: Run research against grants.gov. Verify the artifact contains real grant listings with recognizable NSF/NEH/DOE grant titles, not placeholder text or hallucinated data.

### 15.3 — Draft Prompt Quality

**AC-15.3.1** — When the draft prompt is sent for a grant with real requirements and real org profile data, the resulting `DraftArtifact` MUST:
- Contain at least 3 sections with non-empty `content` (not just section titles)
- Total `wordCount` MUST be ≥ 500 words
- Each section MUST have a `groundingSources` array — at least one section MUST reference a specific Hacker Dojo document or fact
- The content MUST reference Hacker Dojo by name, mission, or specific programs (not generic "your organization" language)
- Section content MUST be substantive paragraphs, not single sentences or bullet points

**AC-15.3.2** — The draft prompt MUST include:
- The full grant details from the crawled/discovered record
- Hacker Dojo's hardcoded organization profile (mission, programs, impact stats)
- Specific instructions about voice and tone
- The exact JSON schema with section structure
- A requirement that each section cites its grounding sources

**AC-15.3.3** — Anti-patterns that MUST cause the prompt to be rewritten:
- Agent returns "I cannot generate this draft" with no section content → prompt needs better context
- Agent returns generic content with no Hacker Dojo specifics → prompt needs to emphasize org profile usage
- Agent returns all sections with `isGrounded: false` → prompt needs to emphasize document grounding
- Agent returns < 200 words → prompt needs to specify minimum content expectations

**AC-15.3.4** — Smoke test scenario: Generate a draft for a real grant (e.g., NSF TechAccess) using Hacker Dojo's hardcoded profile. Verify the draft mentions Hacker Dojo's 17-year track record, specific programs (AI Career Initiative, makerspace operations), and shows grounded sections.

### 15.4 — Match/Scoring Prompt Quality

**AC-15.4.1** — When the match prompt scores a grant against Hacker Dojo's profile, the resulting `MatchArtifact` MUST:
- Have a `fitScore` that is not 0 and not 100 for every grant (scores should vary based on actual alignment)
- Each dimension (`missionAlignment`, `geographicFocus`, etc.) MUST have a non-zero score
- The `rationale` MUST reference specific Hacker Dojo attributes (not just "good match")
- Scores MUST be distinguishable — two different grants should not get identical scores unless they're genuinely identical matches

**AC-15.4.2** — The match prompt MUST include:
- The full Hacker Dojo profile with all program areas, geography, populations served
- The specific grant details to score
- The 5 scoring dimensions with descriptions of what each means
- A requirement to justify each dimension score with specific evidence

### 15.5 — Extract/Award Letter Prompt Quality

**AC-15.5.1** — When the extract prompt processes a real award letter PDF, the resulting `ExtractArtifact` MUST:
- Contain a non-empty `amount` field (the award dollar figure)
- Contain at least one `reportingDeadline` or `budgetCategory`
- Have `confidence` set (not default to "low" when data is clearly present)
- If data cannot be extracted (scanned image, bad OCR), the `errors` array MUST explain what failed

### 15.6 — Prompt Structure Requirements (All Types)

**AC-15.6.1** — Every prompt sent to OpenCode MUST follow this structure:
```
# Task: {type}

## Context
{Hacker Dojo hardcoded profile}
{Relevant grant details, documents, or source URLs}

## Instructions
{Specific, numbered instructions for what to do}

## Output Requirement — CRITICAL
You MUST write a single JSON file to: {ARTIFACT_PATH}

The JSON must match this schema exactly:
```json
{complete JSON schema with example values}
```

## Rules
1. Write ONLY valid, parseable JSON. No markdown, no code fences, no explanatory text in the file.
2. Every field in the schema must be present (unless marked optional).
3. If you cannot complete the task, include an "errors" array explaining why.
4. Use double quotes for all strings. No trailing commas.
5. Do NOT write anything else to this file — only the JSON object.

## Quality Requirements
{Type-specific quality requirements, e.g., "Must find at least 1 grant" or "Must be ≥ 500 words"}
```

**AC-15.6.2** — The prompt MUST be stored alongside the artifact for debugging. Save to `.grant-ops-data/tmp/prompt-{jobId}.txt` before spawning OpenCode.

### 15.7 — Prompt Regression Testing

**AC-15.7.1** — Every prompt template MUST have a unit test that builds the prompt and verifies:
- The prompt contains the artifact path
- The prompt contains the complete JSON schema
- The prompt contains the hardcoded Hacker Dojo profile
- The prompt contains quality requirements specific to the job type
- The prompt does NOT contain any placeholder text like "TODO" or "FIXME"

**AC-15.7.2** — When the hardcoded Hacker Dojo profile is updated (e.g., new program added), a test MUST verify that the updated profile appears in generated prompts. This prevents "stale profile" bugs where the app thinks it's sending updated data but the prompt template isn't picking it up.

### 15.8 — Artifact Quality Gates (Blocking)

**AC-15.8.1** — After schema validation passes, the artifact MUST pass quality gates before ingestion:

| Job Type | Quality Gate | Action on Failure |
|---|---|---|
| research | `grants.length > 0` OR `errors.length > 0` | If both empty: retry with "No grants found and no errors reported. If the source has no grants, explain why in the errors array." |
| draft | `wordCount >= 200` | If < 200 words: retry with "Draft too short ({wordCount} words). Generate at least 500 words across all sections." |
| draft | At least one section with `isGrounded: true` | If none grounded: retry with "No sections are grounded. Reference specific Hacker Dojo documents in groundingSources." |
| match | `fitScore` is not identical for all grants | If all same score: retry with "All grants received identical scores. Differentiate based on actual alignment." |
| extract | `amount` is non-empty OR `errors` explains why | If both empty: retry with "No amount extracted and no errors reported. Either find the amount or explain why it couldn't be extracted." |

**AC-15.8.2** — Quality gate failures count toward the 3-attempt retry limit. If all 3 attempts fail quality gates (not schema, but quality), the artifact is ingested anyway but marked with `qualityWarning: true` and the operator sees: "⚠️ Generated content may be incomplete. The agent produced valid JSON but the content quality is below expectations. You may want to review or retry manually."

### 15.9 — Real Source Verification (One-Time Per Source)

**AC-15.9.1** — When a new source is added, the first crawl MUST be verified manually (cannot be automated — must confirm the agent returned real grants, not hallucinated data):
- The crawl found > 0 grants, OR
- The `errors` array explains why no grants were found (auth required, no results, source changed)

**AC-15.9.2** — If a source consistently returns 0 grants across 3+ crawls with no error explanation, the source MUST be flagged: "⚠️ This source has returned no grants in the last 3 crawls. It may need to be updated or removed."

---

## 16. Technical Infrastructure (from 11-technical-infrastructure.md and 12-data-architecture.md)

### 16.1 — API Route Validation

**AC-16.1.1** — Every API route MUST validate request bodies with Zod schemas. Invalid requests MUST return HTTP 400 with the error contract shape from AC-14.10 and the specific Zod error details.

**AC-16.1.2** — Every API route MUST validate query parameters with Zod schemas. Invalid query params MUST return HTTP 400.

**AC-16.1.3** — The `GET /api/grants` endpoint MUST support pagination via `page` and `pageSize` query parameters. Default pageSize is 25, max is 100.

### 16.2 — Database Connection & Integrity

**AC-16.2.1** — On startup, the app MUST configure better-sqlite3 with these exact PRAGMAs: `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`, `cache_size=-64000`, `foreign_keys=ON`, `temp_store=MEMORY`, `mmap_size=268435456`, `wal_autocheckpoint=1000`.

**AC-16.2.2** — On startup, the app MUST run `PRAGMA quick_check`. If it fails, fall back to `PRAGMA integrity_check`. If either fails: block all writes, show error overlay, offer restore-from-backup.

**AC-16.2.3** — On startup, if a `-wal` file exists from a previous crash, the app MUST run `PRAGMA wal_checkpoint(TRUNCATE)` before any reads.

**AC-16.2.4** — On first run (database file does not exist), the app MUST create all tables, indexes, and FTS5 virtual tables in a single transaction. Seed data MUST be inserted in the same transaction.

**AC-16.2.5** — All `server-only` modules containing better-sqlite3 imports MUST include `import 'server-only'` at the top. Build MUST fail if any such module is imported from a client component.

**AC-16.2.6** — All synchronous better-sqlite3 queries in Route Handlers MUST call `await connection()` from `next/server` before executing. Without this, queries run during prerendering and may throw.

### 16.3 — FTS5 Search

**AC-16.3.1** — The `grants_fts` virtual table MUST use the contentless FTS5 design defined in `12-data-architecture.md` §2.2: it stores a `grantId` text foreign key plus indexed text fields, and AI/AD/AU triggers keep it in sync with the `grants` table.

**AC-16.3.2** — `GET /api/grants?search=...` MUST return results ranked by FTS5 bm25 relevance within 200ms for 500 grants.

**AC-16.3.3** — FTS5 search MUST be combinable with other filters (status, funderType, minFit, maxDeadline). Combined queries MUST return correct intersection results.

**AC-16.3.4** — Soft-deleted grants (`deletedAt IS NOT NULL`) MUST NOT appear in search results.

### 16.4 — Document Upload & Checksums

**AC-16.4.1** — Every document upload MUST compute a SHA-256 checksum via `node:crypto` and store it in `documents.checksum`. The checksum MUST be verifiable after download.

**AC-16.4.2** — Document upload MUST validate MIME type using `file-type` (magic number sniffing), not just the client-reported MIME type.

**AC-16.4.3** — Files MUST be written atomically: temp path → DB record created → rename to final UUID-based filename. If DB write fails, temp file is deleted.

**AC-16.4.4** — Text extraction for PDFs MUST use `pdf-parse` (simple) or `pdfjs-dist` (layout-aware). DOCX extraction MUST use `mammoth.extractRawText()`. Extraction failures MUST set `extractionStatus` to `"failed"` with `extractionError`, NOT crash the upload.

### 16.5 — Notification System

**AC-16.5.1** — Toast notifications MUST stack from top-right, max 3 visible. Success/info toasts auto-dismiss after 5 seconds. Error toasts are sticky until dismissed.

**AC-16.5.2** — The sidebar notification badge count MUST reflect activity events since the last session start (stored in `localStorage`). Clicking the badge opens a drawer of recent activity events.

**AC-16.5.3** — System-driven notifications (crawl complete, draft generated, deadline approaching, backup complete) MUST appear within 5 seconds of the triggering event.

### 16.6 — Budget Import Parsing

**AC-16.6.1** — CSV budget imports MUST use `csv-parse` with `columns: true, cast: true`. XLSX budget imports MUST use `xlsx` (SheetJS) `0.20.3`.

**AC-16.6.2** — The budget import parser MUST detect header rows by scanning the first 10 rows for budget-related keywords (`category`, `item`, `line`, `description`, `amount`, `budget`, `total`, `cost`, `expense`).

**AC-16.6.3** — After parsing, the operator MUST be presented with detected columns for review and confirmation before any data is ingested. No automatic ingestion without operator confirmation.

**AC-16.6.4** — Invalid rows (non-numeric amounts, missing categories) MUST be flagged in the review table with specific error messages. The operator can fix or skip rows.

### 16.7 — Passcode Lock

**AC-16.7.1** — Passcodes MUST be hashed with **argon2id** using these parameters: `memoryCost=65536` (64 MB), `timeCost=3`, `parallelism=4`. If the `argon2` native package fails to compile on macOS, fall back to `bcryptjs` with cost factor 12.

**AC-16.7.2** — The lock screen MUST overlay the entire app with a blurred background. Passcode input is 4–12 characters, masked. After 5 failed attempts, a 30-second cooldown MUST be enforced.

**AC-16.7.3** — Inactivity detection MUST track `mousemove`, `mousedown`, `keydown`, and `touchstart` events. The timer resets on each event. When `passcode.inactivityTimeout` minutes of inactivity are reached, the lock screen appears.

**AC-16.7.4** — All background operations (agent jobs, crawls, timers, backup) MUST continue while the passcode lock is active. Locking MUST NOT interrupt running operations.

**AC-16.7.5** — Manual lock MUST be available via `Cmd+L` / `Ctrl+L` keyboard shortcut and sidebar action.

**AC-16.7.6** — Successful unlock MUST issue an `HttpOnly`, `SameSite=Strict` session cookie. Manual lock or inactivity lock MUST clear that cookie immediately.

### 16.8 — Logging

**AC-16.8.1** — All app logs MUST be structured JSON (one object per line) written by **pino** v10.3.1 via **pino-roll** v4.0.0 with daily rotation, max 10 files, 20MB per file.

**AC-16.8.2** — Log files MUST be written to `.grant-ops-data/logs/`. Agent session logs MUST be written to `.grant-ops-data/tmp/session-{jobId}.log`.

**AC-16.8.3** — Logs MUST include at minimum: `timestamp` (ISO 8601), `level` (error/warn/info/debug), `message` (human-readable), and `module` (identifying the subsystem).

**AC-16.8.4** — The Settings → Logs view MUST allow the operator to browse logs paginated and filter by level. The "View log" button on failed jobs MUST open the specific session log.

**AC-16.8.5** — Debug-level logging MUST be off by default. A toggle in Settings MUST enable it. Full prompt text and raw artifact JSON MUST only be logged at debug level.

**AC-16.8.6** — `activity_events` MUST be trimmed daily to the most recent 20,000 rows and rows older than 365 days MUST be deleted.

### 16.9 — Automated Backup

**AC-16.9.1** — Backups MUST use **`adm-zip`** v0.5.17 to create `.zip` archives. Before backup, `wal_checkpoint(TRUNCATE)` MUST run to flush WAL to the main database file.

**AC-16.9.2** — After zip creation, a SHA-256 checksum MUST be computed via `node:crypto` and written to a companion `.zip.sha256` file. The checksum MUST be verified on restore before replacing any data.

**AC-16.9.3** — The backup scheduler MUST check every 60 minutes whether a backup is due. When due, backup runs and `backup_schedule.nextBackupAt` is updated.

**AC-16.9.4** — If the backup destination has insufficient space (< 200MB free after zip creation), the backup MUST fail with a clear error message and toast notification.

**AC-16.9.5** — When `maxBackups` is exceeded, the oldest backup files MUST be deleted. Deletion happens AFTER the new backup is verified, not before.

### 16.10 — Calendar (iCal Export)

**AC-16.10.1** — Calendar export MUST use **`ical-generator`** v10.2.0 to generate `.ics` files at `.grant-ops-data/exports/calendar.ics`. The export MUST include grant deadlines (with 24h and 1h before alarms), report due dates (with 48h before alarms), and follow-up task due dates.

**AC-16.10.2** — The `GET /api/calendar/export` endpoint MUST return the `.ics` file with `Content-Type: text/calendar` and `Content-Disposition: attachment` headers.

**AC-16.10.3** — The `GET /api/calendar/export/{scope}` endpoint MUST support scoped exports: `grants` (deadlines only), `reports` (report due dates only), `all` (everything).

**AC-16.10.4** — The app MUST NOT connect to any external calendar service (Google, Outlook, iCloud). Calendar integration is export-only — the operator imports the `.ics` file manually.

---

## Release Gate Summary

The app is NOT ready for use unless ALL acceptance criteria in sections 1–15 are verified passing. No exceptions.

### Pre-Release Checklist
- [ ] All 15 sections of AC verified
- [ ] Smoke test suite (Section 15.1) completed against real OpenCode with passing results
- [ ] Smoke test results documented in `.grant-ops-data/smoke-test-results/{version}.json`
- [ ] `pnpm typecheck` passes (zero errors)
- [ ] `pnpm lint` passes (zero errors, zero warnings)
- [ ] `pnpm test` passes (all unit + integration tests)
- [ ] `pnpm test:e2e` passes (all E2E workflows)
- [ ] No dead code (verified with `npx knip` or equivalent)
- [ ] No `any` types, no `@ts-ignore`, no `@ts-expect-error`
- [ ] All API error responses follow the contract shape
- [ ] Agent loop retries work correctly for all 3 failure modes
- [ ] Job cancellation does not corrupt state
- [ ] Database integrity check passes on startup
- [ ] Backup → delete data → restore round-trip verified
- [ ] Prompt templates contain no placeholder text (verified by AC-15.7.1)
- [ ] All quality gates (AC-15.8) pass for at least one real smoke test run per job type
- [ ] All API routes validate inputs with Zod (AC-16.1)
- [ ] Database PRAGMAs configured correctly on startup (AC-16.2.1)
- [ ] FTS5 search returns correct results within 200ms (AC-16.3)
- [ ] Document uploads compute and verify SHA-256 checksums (AC-16.4)
- [ ] Notification toasts appear within 5s of triggering events (AC-16.5)
- [ ] Budget import parser detects headers and presents review table (AC-16.6)
- [ ] Passcode lock uses argon2id with correct parameters (AC-16.7)
- [ ] Logging uses pino with structured JSON and daily rotation (AC-16.8)
- [ ] Automated backup uses adm-zip with SHA-256 verification (AC-16.9)
- [ ] Calendar export generates valid .ics files, no cloud connection (AC-16.10)
