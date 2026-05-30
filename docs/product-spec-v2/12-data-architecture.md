# 12 — Data Architecture

> **Status**: Draft v2 — extracted from 11-technical-infrastructure.md for clarity.
> **Covers**: Connection configuration, WAL pragmas, complete database schema (all tables, indexes, FTS5), seed data, migration strategy, backup considerations.

---

## 1. Connection Configuration

All database access goes through `better-sqlite3` v12.10.0 (bundles SQLite 3.53.1).

### 1.1 — Connection Factory

```typescript
// src/lib/db/connection.ts
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '.grant-ops-data', 'grant-ops.sqlite');

function configurePragmas(db: Database, mode: 'readwrite' | 'readonly'): void {
  if (mode === 'readwrite') {
    // WAL mode — enables concurrent reads + writes
    db.pragma('journal_mode = WAL');

    // Auto-checkpoint every 1000 pages (~10MB for 4KB pages)
    db.pragma('wal_autocheckpoint = 1000');
  }

  // Wait up to 5s when write contention occurs (prevents SQLITE_BUSY)
  db.pragma('busy_timeout = 5000');

  // NORMAL is safe with WAL — only syncs at checkpoints, not every write
  // Provides ~2-3x write speedup vs FULL with acceptable durability
  db.pragma('synchronous = NORMAL');

  // 64MB page cache (-64000 = 64000KB, negative = KB units)
  db.pragma('cache_size = -64000');

  // Enforce foreign key constraints (off by default!)
  db.pragma('foreign_keys = ON');

  // Temp tables in RAM for better performance
  db.pragma('temp_store = MEMORY');

  // 256MB memory-mapped reads (OS handles caching)
  db.pragma('mmap_size = 268435456');
}

// Single writer connection (all mutations go through this)
let writeDb: Database | null = null;
export function getWriteDb(): Database {
  if (!writeDb) {
    writeDb = new Database(DB_PATH);
    configurePragmas(writeDb, 'readwrite');
  }
  return writeDb;
}

// Read pool for concurrent reads (4 replicas, round-robin)
const readDbs: Database[] = [];
let readIndex = 0;

export function initializeReadPool(): void {
  for (let i = 0; i < 4; i++) {
    const db = new Database(DB_PATH, { readonly: true });
    configurePragmas(db, 'readonly');
    readDbs.push(db);
  }
}

export function getReadDb(): Database {
  if (readDbs.length === 0) initializeReadPool();
  return readDbs[readIndex++ % readDbs.length];
}

// Transaction wrapper for atomic operations
export function withTransaction<T>(fn: () => T): T {
  return getWriteDb().transaction(fn)();
}
```

### 1.2 — Why Single Writer + Read Pool

SQLite's locking is **file-level**, not connection-level. Multiple writers still serialize at the OS file level. A write pool provides no benefit and adds complexity. The single-writer connection with `busy_timeout` handles contention correctly.

The 4 read replicas (round-robin) provide concurrent read throughput without blocking writers. WAL mode ensures readers never block writers and writers never block readers.

### 1.3 — WAL Checkpointing

```typescript
// Run on startup for crash recovery
export function recoverFromCrash(): void {
  const db = getWriteDb();
  db.pragma('wal_checkpoint(TRUNCATE)');
}

// Auto-triggered after 1000 write transactions (set via wal_autocheckpoint=1000)
// Manual checkpoint for maintenance:
export function manualCheckpoint(): void {
  const db = getWriteDb();
  const result = db.pragma('wal_checkpoint(TRUNCATE)');
  const { busy, 'pages-in-wal': pagesInWal, 'pages-checkpointed': pagesCheckpointed } = result[0];
  if (busy === 1) console.warn('Checkpoint was blocked by active readers');
}
```

### 1.4 — Integrity Check

```typescript
// Run on startup
export function checkIntegrity(): { ok: boolean; errors: string[] } {
  const db = getWriteDb();
  const result = db.pragma('quick_check');
  const errors = result.filter(row => row.integrity_check !== 'ok')
    .map(row => row.integrity_check);
  return { ok: errors.length === 0, errors };
}
```

If `quick_check` fails, fall back to `integrity_check` (full bidirectional scan). If both fail:
- Block all writes
- Show error: "Database integrity check failed. Your data may be corrupted."
- Offer restore-from-backup option

---

## 2. Complete Database Schema

All tables live in `.grant-ops-data/grant-ops.sqlite`.

### 2.1 — Grants (Core Table)

```sql
CREATE TABLE grants (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  funder TEXT NOT NULL,
  funderShort TEXT DEFAULT '',
  award TEXT DEFAULT '',
  awardSort REAL DEFAULT 0,
  deadline TEXT DEFAULT '',
  deadlineConfidence TEXT CHECK(deadlineConfidence IN ('exact','estimated','rolling','unknown')) DEFAULT 'unknown',
  eligibility TEXT DEFAULT '',
  requirements TEXT DEFAULT '[]',  -- JSON array
  externalUrl TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',  -- JSON array
  category TEXT DEFAULT '',
  fitScore REAL DEFAULT 0,
  fitBreakdown TEXT DEFAULT '{}',  -- JSON: {missionAlignment, geographicFocus, programTrackrecord, budgetCapacity, partnershipReadiness}
  fitRationale TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'matched'
    CHECK(status IN ('matched','draft','review','approved','submission-ready','submitted','follow-up','awarded','declined','closed','archived')),
  sourceId TEXT REFERENCES sources(id) ON DELETE SET NULL,
  customFields TEXT DEFAULT '{}',  -- JSON: user-defined tracker fields
  matchedAt TEXT DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  deletedAt TEXT DEFAULT NULL  -- soft delete
);

-- Indexes for frequent query patterns
CREATE INDEX idx_grants_status ON grants(status);
CREATE INDEX idx_grants_deadline ON grants(deadline);
CREATE INDEX idx_grants_fitScore ON grants(fitScore);
CREATE INDEX idx_grants_funder ON grants(funder);
CREATE INDEX idx_grants_deletedAt ON grants(deletedAt);
CREATE INDEX idx_grants_status_deadline ON grants(status, deadline);  -- composite: urgent grants
CREATE INDEX idx_grants_sourceId ON grants(sourceId);
```

### 2.2 — Full-Text Search (FTS5)

```sql
-- Standalone FTS5 table with explicit TEXT foreign key.
-- The index stores a copy of searchable text plus the stable grantId.
CREATE VIRTUAL TABLE grants_fts USING fts5(
  grantId UNINDEXED,
  title,
  funder,
  funderShort,
  summary,
  eligibility,
  tags,
  category,
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER grants_ai AFTER INSERT ON grants BEGIN
  INSERT INTO grants_fts(grantId, title, funder, funderShort, summary, eligibility, tags, category)
  VALUES (new.id, new.title, new.funder, new.funderShort, new.summary, new.eligibility, new.tags, new.category);
END;

CREATE TRIGGER grants_ad AFTER DELETE ON grants BEGIN
  DELETE FROM grants_fts WHERE grantId = old.id;
END;

CREATE TRIGGER grants_au AFTER UPDATE ON grants BEGIN
  DELETE FROM grants_fts WHERE grantId = old.id;
  INSERT INTO grants_fts(grantId, title, funder, funderShort, summary, eligibility, tags, category)
  VALUES (new.id, new.title, new.funder, new.funderShort, new.summary, new.eligibility, new.tags, new.category);
END;
```

**FTS5 query example** (with bm25 ranking):

```typescript
export function searchGrants(query: string, limit = 20): Grant[] {
  const db = getReadDb();
  const ftsQuery = query
    .replace(/['"]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(term => `"${term}"*`)
    .join(' OR ') || '"*"';

  return db.prepare(`
    SELECT g.*, bm25(grants_fts) as rank
    FROM grants_fts
    JOIN grants g ON g.id = grants_fts.grantId
    WHERE grants_fts MATCH ? AND g.deletedAt IS NULL
    ORDER BY rank
    LIMIT ?
  `).all(ftsQuery, limit) as Grant[];
}
```

### 2.3 — Sources

```sql
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT CHECK(type IN ('federal','state','foundation','corporate','community','api','peer','other')) DEFAULT 'other',
  category TEXT DEFAULT '',
  intervalHours INTEGER NOT NULL DEFAULT 168,
  crawlState TEXT CHECK(crawlState IN ('never-crawled','queued','running','succeeded','partially-failed','failed')) DEFAULT 'never-crawled',
  lastCrawledAt TEXT DEFAULT '',
  lastCrawlGrantCount INTEGER DEFAULT 0,
  lastCrawlError TEXT DEFAULT '',
  consecutiveFailures INTEGER DEFAULT 0,
  isBuiltIn INTEGER DEFAULT 0,  -- 1 = pre-configured (hardcoded profile), cannot be deleted
  isPeerSource INTEGER DEFAULT 0,  -- 1 = peer discovery source
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sources_crawlState ON sources(crawlState);
CREATE INDEX idx_sources_type ON sources(type);
```

### 2.4.1 — Crawl Runs

```sql
CREATE TABLE crawl_runs (
  id TEXT PRIMARY KEY,
  sourceId TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  jobId TEXT REFERENCES agent_jobs(id) ON DELETE SET NULL,
  startedAt TEXT NOT NULL,
  completedAt TEXT DEFAULT '',
  status TEXT CHECK(status IN ('queued','running','completed','partial','failed','cancelled')) NOT NULL,
  grantsFound INTEGER DEFAULT 0,
  pagesCrawled INTEGER DEFAULT 0,
  pagesFailed INTEGER DEFAULT 0,
  errorMessage TEXT DEFAULT '',
  artifactPath TEXT DEFAULT ''
);

CREATE INDEX idx_crawl_runs_sourceId ON crawl_runs(sourceId);
CREATE INDEX idx_crawl_runs_startedAt ON crawl_runs(startedAt);
```

### 2.5 — Funder Profiles

```sql
CREATE TABLE funder_profiles (
  id TEXT PRIMARY KEY,
  sourceId TEXT REFERENCES sources(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('foundation','government','corporate','community','other')) DEFAULT 'other',
  ein TEXT DEFAULT '',
  givingHistory TEXT DEFAULT '[]',
  focusAreas TEXT DEFAULT '[]',
  geographicFocus TEXT DEFAULT '[]',
  typicalAwardRange TEXT DEFAULT '{}',
  applicationProcess TEXT DEFAULT '',
  deadlines TEXT DEFAULT '',
  sourceUrls TEXT DEFAULT '[]',
  lastUpdated TEXT NOT NULL DEFAULT (datetime('now')),
  generatedInsights TEXT DEFAULT '{}'
);

CREATE INDEX idx_funder_profiles_sourceId ON funder_profiles(sourceId);
CREATE INDEX idx_funder_profiles_type ON funder_profiles(type);
```

### 2.6 — Pipeline Transitions (Audit Log)

```sql
CREATE TABLE pipeline_transitions (
  id TEXT PRIMARY KEY,
  grantId TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  fromState TEXT NOT NULL,
  toState TEXT NOT NULL,
  reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'user',
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transitions_grantId ON pipeline_transitions(grantId);
CREATE INDEX idx_transitions_timestamp ON pipeline_transitions(timestamp);
```

### 2.7 — Tasks

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  grantId TEXT REFERENCES grants(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT CHECK(status IN ('blocked','in-progress','completed','waived','not-applicable')) DEFAULT 'in-progress',
  responsibility TEXT CHECK(responsibility IN ('finance','program','review','follow-up')) DEFAULT 'review',
  blockSubmission INTEGER DEFAULT 0,  -- 1 = blocks transition to submission-ready
  dueDate TEXT DEFAULT '',
  completedAt TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tasks_grantId ON tasks(grantId);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_dueDate ON tasks(dueDate);
CREATE INDEX idx_tasks_blockSubmission ON tasks(blockSubmission);
```

### 2.8 — Documents

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  grantId TEXT REFERENCES grants(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,          -- UUID-based storage filename
  originalName TEXT NOT NULL,      -- Original upload filename
  mimeType TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL,
  classification TEXT CHECK(classification IN ('canonical','draft-only','restricted')) DEFAULT 'draft-only',
  extractedText TEXT DEFAULT '',
  extractionStatus TEXT CHECK(extractionStatus IN ('pending','extracted','stored_unparsed','failed')) DEFAULT 'pending',
  extractionError TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',  -- JSON array
  checksum TEXT DEFAULT '',  -- SHA-256 hash for integrity verification
  uploadedAt TEXT NOT NULL DEFAULT (datetime('now')),
  deletedAt TEXT DEFAULT NULL
);

CREATE INDEX idx_documents_grantId ON documents(grantId);
CREATE INDEX idx_documents_classification ON documents(classification);
```

### 2.9 — Draft Versions

```sql
CREATE TABLE draft_versions (
  id TEXT PRIMARY KEY,
  grantId TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  jobId TEXT NOT NULL,
  content TEXT NOT NULL,
  sections TEXT NOT NULL DEFAULT '[]',  -- JSON array of {sectionTitle, content, groundingSources, isGrounded}
  wordCount INTEGER DEFAULT 0,
  groundingDocumentIds TEXT DEFAULT '[]',  -- JSON array of document IDs
  groundingSourceUrls TEXT DEFAULT '[]',   -- JSON array of URLs
  notes TEXT DEFAULT '',
  status TEXT CHECK(status IN ('draft','approved','locked')) DEFAULT 'draft',
  qualityWarning INTEGER DEFAULT 0,  -- 1 = passed schema but failed quality gate
  approvedAt TEXT DEFAULT '',
  approvedBy TEXT DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(grantId, version)
);

CREATE INDEX idx_drafts_grantId ON draft_versions(grantId);
CREATE INDEX idx_drafts_grantId_version ON draft_versions(grantId, version);
```

### 2.10 — Snippets (Institutional Memory)

```sql
CREATE TABLE snippets (
  id TEXT PRIMARY KEY,
  sectionTitle TEXT NOT NULL,
  content TEXT NOT NULL,
  sourceGrantId TEXT REFERENCES grants(id) ON DELETE SET NULL,
  sourceFunder TEXT DEFAULT '',
  topicTags TEXT DEFAULT '[]',  -- JSON array
  programArea TEXT DEFAULT '',
  usedCount INTEGER DEFAULT 0,
  lastUsedAt TEXT DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_snippets_topicTags ON snippets(topicTags);
CREATE INDEX idx_snippets_programArea ON snippets(programArea);
```

### 2.11 — Application Form Templates

```sql
CREATE TABLE application_form_templates (
  id TEXT PRIMARY KEY,
  funderName TEXT NOT NULL,
  title TEXT NOT NULL,
  schemaJson TEXT NOT NULL,
  mappingRulesJson TEXT DEFAULT '{}',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_form_templates_funderName ON application_form_templates(funderName);
```

### 2.12 — Outreach Records

```sql
CREATE TABLE outreach_records (
  id TEXT PRIMARY KEY,
  grantId TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  contactName TEXT NOT NULL,
  organization TEXT DEFAULT '',
  method TEXT CHECK(method IN ('email','phone','in-person','other')) DEFAULT 'email',
  responseStatus TEXT CHECK(responseStatus IN ('awaiting-reply','confirmed','declined','no-response')) DEFAULT 'awaiting-reply',
  contactedAt TEXT NOT NULL,
  responseAt TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  linkedDocumentId TEXT REFERENCES documents(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_outreach_grantId ON outreach_records(grantId);
CREATE INDEX idx_outreach_responseStatus ON outreach_records(responseStatus);
```

### 2.13 — Awards

```sql
CREATE TABLE awards (
  id TEXT PRIMARY KEY,
  grantId TEXT NOT NULL REFERENCES grants(id) UNIQUE,
  amount REAL NOT NULL DEFAULT 0,
  startDate TEXT NOT NULL DEFAULT '',
  endDate TEXT NOT NULL DEFAULT '',
  awardLetterDocumentId TEXT REFERENCES documents(id),
  extractionConfidence TEXT CHECK(extractionConfidence IN ('high','medium','low')) DEFAULT 'medium',
  extractionData TEXT DEFAULT '{}',  -- JSON: full ExtractArtifact data
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.14 — Award Budget Categories

```sql
CREATE TABLE award_budget_categories (
  id TEXT PRIMARY KEY,
  awardId TEXT NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  budgetedAmount REAL NOT NULL DEFAULT 0,
  spentAmount REAL NOT NULL DEFAULT 0,
  plannedAmount REAL NOT NULL DEFAULT 0,  -- future planned expenses
  restrictions TEXT DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_budget_awardId ON award_budget_categories(awardId);
```

### 2.15 — Award Expenses

```sql
CREATE TABLE award_expenses (
  id TEXT PRIMARY KEY,
  awardId TEXT NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  categoryId TEXT NOT NULL REFERENCES award_budget_categories(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT (date('now')),
  description TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  receiptDocumentId TEXT REFERENCES documents(id),
  isPlanned INTEGER DEFAULT 0,  -- 1 = planned (future), 0 = actual (past)
  notes TEXT DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_expenses_awardId ON award_expenses(awardId);
CREATE INDEX idx_expenses_categoryId ON award_expenses(categoryId);
```

### 2.16 — Award Reporting Deadlines

```sql
CREATE TABLE award_report_deadlines (
  id TEXT PRIMARY KEY,
  awardId TEXT NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- e.g., "Quarterly Progress Report", "Annual Financial Report"
  dueDate TEXT NOT NULL,
  format TEXT DEFAULT '',  -- e.g., "PDF via grants.gov"
  status TEXT CHECK(status IN ('pending','submitted','overdue')) DEFAULT 'pending',
  submittedAt TEXT DEFAULT '',
  documentId TEXT REFERENCES documents(id),
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_report_deadlines_awardId ON award_report_deadlines(awardId);
CREATE INDEX idx_report_deadlines_dueDate ON award_report_deadlines(dueDate);
```

### 2.17 — Award Compliance Items

```sql
CREATE TABLE award_compliance_items (
  id TEXT PRIMARY KEY,
  awardId TEXT NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  requirement TEXT NOT NULL,
  status TEXT CHECK(status IN ('compliant','at-risk','non-compliant')) DEFAULT 'compliant',
  evidence TEXT DEFAULT '',
  dueDate TEXT DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_compliance_awardId ON award_compliance_items(awardId);
```

### 2.18 — Activity Events

```sql
CREATE TABLE activity_events (
  id TEXT PRIMARY KEY,
  eventType TEXT NOT NULL,  -- e.g., "grant.matched", "draft.generated", "crawl.completed"
  entityId TEXT NOT NULL,
  entityType TEXT NOT NULL,  -- e.g., "grant", "draft", "source", "award"
  summary TEXT NOT NULL,     -- human-readable event description
  metadata TEXT DEFAULT '{}',  -- JSON: event-specific data
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_activity_timestamp ON activity_events(timestamp);
CREATE INDEX idx_activity_entity ON activity_events(entityType, entityId);
CREATE INDEX idx_activity_type ON activity_events(eventType);
```

### 2.19 — Saved Searches

```sql
CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  queryText TEXT NOT NULL,
  filters TEXT DEFAULT '{}',  -- JSON: {categories, funderTypes, minAward, maxAward, geography}
  newResultsCount INTEGER DEFAULT 0,
  lastCheckedAt TEXT DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.20 — Settings (Key-Value Store)

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

See [11-technical-infrastructure.md §7](./11-technical-infrastructure.md#7-configuration--operator-preferences) for all setting keys and defaults.

### 2.21 — Agent Jobs

```sql
CREATE TABLE agent_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('research','draft','crawl','match','extract')),
  grantId TEXT,
  sourceId TEXT REFERENCES sources(id) ON DELETE SET NULL,
  params TEXT DEFAULT '{}',  -- JSON: type-specific parameters
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK(status IN ('queued','running','verifying','retrying','completed','failed','cancelled')),
  retryCount INTEGER DEFAULT 0,
  maxRetries INTEGER DEFAULT 3,
  progress INTEGER DEFAULT 0,     -- 0-100
  progressStage TEXT DEFAULT '',
  processPid INTEGER DEFAULT NULL,
  processStartedAt TEXT DEFAULT '',
  artifactPath TEXT DEFAULT '',
  errorMessage TEXT DEFAULT '',
  qualityWarning INTEGER DEFAULT 0,  -- 1 = content quality below threshold
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_jobs_status ON agent_jobs(status);
CREATE INDEX idx_jobs_type ON agent_jobs(type);
```

### 2.22 — Schema Versions

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.23 — Backup Schedule

```sql
CREATE TABLE backup_schedule (
  id INTEGER PRIMARY KEY CHECK(id = 1),  -- singleton row
  enabled INTEGER DEFAULT 0,
  intervalHours INTEGER DEFAULT 168,  -- weekly default
  maxBackups INTEGER DEFAULT 10,
  lastBackupAt TEXT DEFAULT '',
  lastBackupPath TEXT DEFAULT '',
  lastBackupChecksum TEXT DEFAULT '',
  lastBackupVerified INTEGER DEFAULT 0,
  nextBackupAt TEXT DEFAULT ''
);
```



---

## 3. Seed Data

On first run, the app seeds:

### 3.1 — Built-in Sources
From the hardcoded profile (01-core-concept.md §Pre-Configured Default Sources):
- grants.gov (federal, 24h interval)
- nsf.gov (federal, 48h interval)
- Google.org (corporate, 168h interval)
- Knight Foundation (foundation, 168h interval)
- Sloan Foundation (foundation, 168h interval)
- Schmidt Futures (foundation, 168h interval)
- ProPublica Nonprofit API (api, 24h interval)
- California Grants Portal (state, 168h interval)

### 3.2 — Peer Discovery Sources
From the hardcoded profile (11-technical-infrastructure.md §9.2):
- Noisebridge, TechShop, NYC Resistor, Dallas Makerspace, Artisan's Asylum
- All marked as `isPeerSource=1, intervalHours=720` (monthly)

### 3.3 — System Rows
- **Settings**: autoDraftThreshold=75, voiceAndTone from hardcoded profile, agent.maxConcurrentJobs=3, crawl.maxConcurrentCrawls=1, notifications.deadlineWarningDays=7, notifications.reportWarningDays=14
- **Backup schedule**: singleton row (enabled=0, intervalHours=168, maxBackups=10)

### 3.4 — Operator Name
Written to the `settings` table (key=`operator.name`). Prompted on first launch — the only onboarding step.

---

## 4. Schema Initialization & Forward Migrations

There is no legacy v1 migration path. However, once a v2 operator has persisted data, future schema changes MUST preserve that data through a lightweight, forward-only migration framework.

### 4.1 — First Run

On first run, the app checks if `grant-ops.sqlite` exists. If not:
1. Create the database file
2. Run `configurePragmas()` (WAL, busy_timeout, etc.)
3. Execute all `CREATE TABLE` / `CREATE INDEX` / FTS5 statements in a single transaction
4. Insert seed data (§3)
5. Insert `schema_migrations(version=1, name='initial-schema')`

If the file already exists, verify integrity (PRAGMA quick_check) and proceed.

### 4.2 — Schema Changes (Future)

Per the "no backward compatibility" principle (01-core-concept.md), old schemas are not supported indefinitely, but persisted operator data must still be transformed forward between released v2 builds. Therefore:
- Schema changes are handled by ordered SQL migration scripts
- Migrations are **forward-only**; down-migrations are not required
- Each migration runs inside a transaction
- Before any migration, the app creates an automatic SQLite file backup
- If migration fails, startup aborts and the operator is directed to the backup

If the operator explicitly chooses a destructive rebuild instead, the app MUST create a backup first and require confirmation.

### 4.3 — SQLite Gotchas

1. **WAL + cloud sync folders**: `.grant-ops-data/` MUST NOT live inside iCloud/Dropbox/OneDrive or any other file-sync directory. WAL mode is required by the architecture; switching to `journal_mode = TRUNCATE` is not supported. On startup, the app MUST detect cloud-synced locations and block launch until the data directory is moved to a normal local path.
2. **FTS triggers + `RETURNING`**: SQLite bug — `RETURNING` + FTS triggers in a transaction fail silently. Always use `lastInsertRowid` after INSERT.
3. **`-shm` and `-wal` companion files**: Must be present and consistent with the main `.sqlite` file. On backup/copy, copy ALL three files together. WAL mode databases cannot be backed up by copying only the `.sqlite` file.
4. **`temp_store=MEMORY`**: Safe for this app's workload. Do NOT use for databases > 1GB or operations like VACUUM on large databases — can exhaust memory.

---

## 5. Backup Considerations

### 5.1 — Backup Contents
Manual and automated backups include (via `adm-zip`):
1. SQLite database file (`.grant-ops-data/grant-ops.sqlite`)
2. All files in `.grant-ops-data/documents/`
3. All files in `.grant-ops-data/artifacts/`
4. Any exported calendar `.ics` files and backup manifests required for restore validation

The `-wal` and `-shm` files are NOT included — the app runs `wal_checkpoint(TRUNCATE)` before backup to ensure all data is in the main database file.

### 5.2 — Integrity Verification
After zip creation, SHA-256 hash is computed via `node:crypto` and stored alongside the zip (`backup-{timestamp}.zip.sha256`). On restore, the hash is verified before replacing any data.

### 5.3 — Restore Safety
- Validate the zip contains a valid SQLite database (runs `PRAGMA integrity_check` on restored DB before replacing current)
- Warn if backup is > 7 days old
- Create a pre-restore backup of current state before overwriting
- Require explicit confirmation
- Pause acceptance of new jobs before both backup and restore operations
- Wait for running write transactions to complete
- Close the writer connection and all read replicas before zipping or replacing database/artifact files
- Re-open connections only after backup verification or restore integrity checks pass

---

## Implementation Checklist

- [ ] Implement connection factory with all PRAGMAs
- [ ] Implement read pool (4 replicas, round-robin)
- [ ] Implement crash recovery (`wal_checkpoint(TRUNCATE)` on startup)
- [ ] Implement integrity check on startup
- [ ] Create all tables, indexes, and FTS5 on first run (single transaction)
- [ ] Create FTS5 triggers (AI, AD, AU)
- [ ] Insert seed data on first run
- [ ] Create funder_profiles, outreach_records, and application_form_templates tables
- [ ] Test: FTS search returns correct results with bm25 ranking
- [ ] Test: WAL checkpoint before backup includes all data
- [ ] Test: cloud sync folder detection warns operator
