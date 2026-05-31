import 'server-only';
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { PersistedData } from "./grant-ops-persistence";
import {
	defaultOpencodeSettings,
	defaultProfile,
} from "./seed-data";
import {
	SEED_FUNDERS,
	SEED_SOURCES,
	SEED_SCHEDULES,
} from "./seed-funders";
import type {
	ApprovalRecord,
	AuditEvent,
	Award,
	AwardBudgetCategory,
	AwardComplianceItem,
	AwardExpense,
	AwardReportDeadline,
	ConflictRecord,
	CrawlRun,
	CrawlSchedule,
	DocumentMetadata,
	DraftArtifact,
	DraftSnippet,
	DuplicateCandidate,
	FollowUp,
	FunderProfile,
	Grant,
	JobFailureCategory,
	JobQueueItem,
	Notification,
	OpencodeSettings,
	OrganizationProfile,
	PeerDiscoveryResult,
	PlannedExpense,
	RevisionRequest,
	SavedSearch,
	Source,
	SubmissionManifest,
	SubmissionRecord,
	Task,
	BackupFreshnessStatus,
	BackupVerificationRecord,
	ThemesData,
} from "./types";

/**
 * Normalize grant detail fields with safe defaults.
 * This is a local implementation that does not depend on seed-data helpers.
 */
function normalizeGrantDetailFields(grant: Grant): Grant {
	const normalized: Grant = {
		...grant,
		latestDraftVersion: grant.latestDraftVersion ?? (grant.draftContent ? 1 : 0),
		groundedDocumentCount: grant.groundedDocumentCount ?? 0,
		sourceCount: grant.sourceCount ?? 0,
	};
	return normalized;
}

export interface SqliteBootstrapState {
	dataDir: string;
	dbPath: string;
	documentsDir: string;
}

type SqliteDatabase = InstanceType<typeof Database>;

const dbCache = new Map<string, SqliteDatabase>();
const initialized = new Set<string>();

type SqliteShutdownGlobal = typeof globalThis & {
	__grantOpsSqliteShutdownRegistered?: boolean;
};

const sqliteShutdownGlobal = globalThis as SqliteShutdownGlobal;

function closeSqliteConnections(): void {
	resetSqliteCache();
}

function handleSqliteShutdown(): void {
	closeSqliteConnections();
	process.exit(0);
}

if (!sqliteShutdownGlobal.__grantOpsSqliteShutdownRegistered) {
	sqliteShutdownGlobal.__grantOpsSqliteShutdownRegistered = true;
	process.once("SIGINT", handleSqliteShutdown);
	process.once("SIGTERM", handleSqliteShutdown);
}

export function resolveDataDir(): string {
	if (process.env.DATA_DIR) {
		return path.resolve(process.env.DATA_DIR);
	}

	return path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		"..",
		".grant-ops-data",
	);
}

export function getSqliteState(
	dataDir = resolveDataDir(),
): SqliteBootstrapState {
	return {
		dataDir,
		dbPath: path.join(dataDir, "grant-ops.sqlite"),
		documentsDir: path.join(dataDir, "documents"),
	};
}

export function openDatabase(state: SqliteBootstrapState): SqliteDatabase {
	const existing = dbCache.get(state.dataDir);
	if (existing) {
		try {
			existing.prepare('SELECT 1').get();
			return existing;
		} catch {
			dbCache.delete(state.dataDir);
		}
	}

	mkdirSync(state.dataDir, { recursive: true });

	const walPath = `${state.dbPath}-wal`;
	if (existsSync(walPath)) {
		try {
			const tempDb = new Database(state.dbPath, { readonly: false });
			tempDb.pragma('journal_mode = WAL');
			const cpRow = tempDb.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get() as { busy: number; log: number; checkpointed: number } | undefined;
			if (!cpRow || cpRow.busy !== 0) {
				throw new Error('WAL checkpoint failed: database is busy from previous crash. WAL file preserved for manual recovery.');
			}
			tempDb.close();
		} catch (err) {
			throw new Error(
				`Database recovery failed: WAL file from previous crash could not be checkpointed. ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	const db = new Database(state.dbPath);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");

	try {
		const checkRow = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string } | undefined;
		if (!checkRow || checkRow.integrity_check !== 'ok') {
			throw new Error(
				`Database integrity check failed: ${checkRow?.integrity_check ?? 'unknown error'}. Restore from backup or recreate the database.`,
			);
		}
	} catch (err) {
		db.close();
		throw new Error(
			`Database integrity check failed: ${err instanceof Error ? err.message : String(err)}. Restore from backup or recreate the database.`,
		);
	}

	ensureSchema(db);
	dbCache.set(state.dataDir, db);
	dbToDataDir.set(db, state.dataDir);
	return db;
}

const writeCounters = new Map<string, number>();
const WAL_CHECKPOINT_INTERVAL = 1000;
const dbToDataDir = new WeakMap<SqliteDatabase, string>();

function incrementWriteCounterForDb(db: SqliteDatabase): void {
	const dataDir = dbToDataDir.get(db);
	if (!dataDir) return;
	const current = writeCounters.get(dataDir) ?? 0;
	const next = current + 1;
	writeCounters.set(dataDir, next);

	if (next >= WAL_CHECKPOINT_INTERVAL) {
		setImmediate(() => {
			try {
				db.pragma('wal_checkpoint(PASSIVE)');
			} catch {
				// best effort checkpoint
			}
		});
		writeCounters.set(dataDir, 0);
	}
}

export function resetSqliteCache(dataDir?: string): void {
	if (dataDir) {
		const db = dbCache.get(dataDir);
		if (db) {
			db.close();
			dbCache.delete(dataDir);
		}
		initialized.delete(dataDir);
		return;
	}

	for (const [key, db] of dbCache.entries()) {
		db.close();
		dbCache.delete(key);
	}
	initialized.clear();
}

// ============ CONNECTION FACTORY (v2) ============

function configurePragmas(db: SqliteDatabase, mode: 'readwrite' | 'readonly'): void {
	if (mode === 'readwrite') {
		db.pragma('journal_mode = WAL');
		db.pragma('wal_autocheckpoint = 1000');
	}
	db.pragma('busy_timeout = 5000');
	db.pragma('synchronous = NORMAL');
	db.pragma('cache_size = -64000');
	db.pragma('foreign_keys = ON');
	db.pragma('temp_store = MEMORY');
	db.pragma('mmap_size = 268435456');
}

// Single writer connection
let writeDb: SqliteDatabase | null = null;

export function getWriteDb(state: SqliteBootstrapState): SqliteDatabase {
	if (!writeDb) {
		writeDb = new Database(state.dbPath);
		configurePragmas(writeDb, 'readwrite');
	}
	return writeDb!;
}

// Read pool for concurrent reads (4 replicas, round-robin)
const readDbs: SqliteDatabase[] = [];
let readIndex = 0;

export function initializeReadPool(state: SqliteBootstrapState): void {
	for (let i = 0; i < 4; i++) {
		const db = new Database(state.dbPath, { readonly: true });
		configurePragmas(db, 'readonly');
		readDbs.push(db);
	}
}

export function getReadDb(state: SqliteBootstrapState): SqliteDatabase {
	if (readDbs.length === 0) initializeReadPool(state);
	return readDbs[readIndex++ % readDbs.length]!;
}

export function withTransaction<T>(db: SqliteDatabase, fn: () => T): T {
	return db.transaction(fn)();
}

export function recoverFromCrash(state: SqliteBootstrapState): void {
	const db = getWriteDb(state);
	db.pragma('wal_checkpoint(TRUNCATE)');
}

export function checkIntegrity(state: SqliteBootstrapState): { ok: boolean; errors: string[] } {
	const db = getWriteDb(state);
	const result = db.pragma('quick_check') as unknown as Array<{ integrity_check: string }>;
	const errors = result.filter((row) => row.integrity_check !== 'ok').map((row) => row.integrity_check);
	if (errors.length > 0) {
		const fullResult = db.pragma('integrity_check') as unknown as Array<{ integrity_check: string }>;
		const fullErrors = fullResult.filter((row) => row.integrity_check !== 'ok').map((row) => row.integrity_check);
		return { ok: false, errors: fullErrors };
	}
	return { ok: true, errors: [] };
}

function ensureSchema(db: SqliteDatabase): void {
	db.exec(`
    CREATE TABLE IF NOT EXISTS grants (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS crawl_runs (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS draft_artifacts (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS revision_requests (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS approval_records (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS submission_records (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS follow_ups (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profile (
      id TEXT PRIMARY KEY CHECK (id = 'profile'),
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS opencode_settings (
      id TEXT PRIMARY KEY CHECK (id = 'opencode_settings'),
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      actor_label TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT
    );
    CREATE TABLE IF NOT EXISTS job_queue (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      stage TEXT,
      last_update TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      entity_id TEXT,
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      result_summary TEXT,
      failure_category TEXT
    );
    CREATE TABLE IF NOT EXISTS duplicate_candidates (
      id TEXT PRIMARY KEY,
      grant_id1 TEXT NOT NULL,
      grant_id2 TEXT NOT NULL,
      confidence_score REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      detected_at TEXT NOT NULL,
      conflicting_fields TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by TEXT
    );
    CREATE TABLE IF NOT EXISTS conflict_records (
      id TEXT PRIMARY KEY,
      grant_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      values_json TEXT NOT NULL,
      canonical_value TEXT,
      resolved_at TEXT,
      resolved_by TEXT
    );
    CREATE TABLE IF NOT EXISTS submission_manifests (
      id TEXT PRIMARY KEY,
      grant_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      instructions TEXT,
      portal_url TEXT,
      file_constraints TEXT,
      due_date TEXT,
      material_refs TEXT NOT NULL DEFAULT '[]',
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS crawl_schedules (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1,
      migrated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS themes_data (
      id TEXT PRIMARY KEY CHECK (id = 'themes_data'),
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS funder_profiles (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_searches (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS awards (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS award_budget_categories (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS award_expenses (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS planned_expenses (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS award_report_deadlines (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS award_compliance_items (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS draft_snippets (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS peer_discovery_results (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );

    -- === V2 TYPED SCHEMA (added alongside JSON tables for incremental migration) ===

    -- 2.1 Grants (typed columns)
    CREATE TABLE IF NOT EXISTS grants_v2 (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      funder TEXT NOT NULL,
      funderShort TEXT DEFAULT '',
      award TEXT DEFAULT '',
      awardSort REAL DEFAULT 0,
      deadline TEXT DEFAULT '',
      deadlineConfidence TEXT CHECK(deadlineConfidence IN ('exact','estimated','rolling','unknown')) DEFAULT 'unknown',
      eligibility TEXT DEFAULT '',
      requirements TEXT DEFAULT '[]',
      externalUrl TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      category TEXT DEFAULT '',
      fitScore REAL DEFAULT 0,
      fitBreakdown TEXT DEFAULT '{}',
      fitRationale TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'matched'
        CHECK(status IN ('matched','draft','review','approved','submission-ready','submitted','follow-up','awarded','declined','closed','archived')),
      sourceId TEXT REFERENCES sources(id) ON DELETE SET NULL,
      customFields TEXT DEFAULT '{}',
      matchedAt TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      deletedAt TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_grants_v2_status ON grants_v2(status);
    CREATE INDEX IF NOT EXISTS idx_grants_v2_deadline ON grants_v2(deadline);
    CREATE INDEX IF NOT EXISTS idx_grants_v2_fitScore ON grants_v2(fitScore);
    CREATE INDEX IF NOT EXISTS idx_grants_v2_funder ON grants_v2(funder);
    CREATE INDEX IF NOT EXISTS idx_grants_v2_deletedAt ON grants_v2(deletedAt);
    CREATE INDEX IF NOT EXISTS idx_grants_v2_status_deadline ON grants_v2(status, deadline);
    CREATE INDEX IF NOT EXISTS idx_grants_v2_sourceId ON grants_v2(sourceId);

    -- 2.2 Full-Text Search (FTS5)
    CREATE VIRTUAL TABLE IF NOT EXISTS grants_fts USING fts5(
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

    -- FTS5 triggers
    CREATE TRIGGER IF NOT EXISTS grants_v2_ai AFTER INSERT ON grants_v2 BEGIN
      INSERT INTO grants_fts(grantId, title, funder, funderShort, summary, eligibility, tags, category)
      VALUES (new.id, new.title, new.funder, new.funderShort, new.summary, new.eligibility, new.tags, new.category);
    END;
    CREATE TRIGGER IF NOT EXISTS grants_v2_ad AFTER DELETE ON grants_v2 BEGIN
      DELETE FROM grants_fts WHERE grantId = old.id;
    END;
    CREATE TRIGGER IF NOT EXISTS grants_v2_au AFTER UPDATE ON grants_v2 BEGIN
      DELETE FROM grants_fts WHERE grantId = old.id;
      INSERT INTO grants_fts(grantId, title, funder, funderShort, summary, eligibility, tags, category)
      VALUES (new.id, new.title, new.funder, new.funderShort, new.summary, new.eligibility, new.tags, new.category);
    END;

    -- 2.3 Sources (typed)
    CREATE TABLE IF NOT EXISTS sources_v2 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'website' CHECK(type IN ('website','rss','api','database','pdf','spreadsheet')),
      category TEXT DEFAULT '' CHECK(category IN ('foundation','government','corporate','community','other','')),
      reviewStatus TEXT DEFAULT 'pending-review' CHECK(reviewStatus IN ('pending-review','approved','rejected')),
      crawlAccessCategory TEXT DEFAULT 'crawlable' CHECK(crawlAccessCategory IN ('crawlable','crawlable-with-auth','manual-only','unsupported')),
      isPeerSource INTEGER DEFAULT 0,
      suggestedBy TEXT DEFAULT '',
      suggestionReason TEXT DEFAULT '',
      intervalHours INTEGER DEFAULT 168,
      lastCrawledAt TEXT DEFAULT '',
      nextCrawlAt TEXT DEFAULT '',
      errorCount INTEGER DEFAULT 0,
      lastError TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sources_v2_type ON sources_v2(type);
    CREATE INDEX IF NOT EXISTS idx_sources_v2_reviewStatus ON sources_v2(reviewStatus);

    -- 2.4 Crawl Runs (typed)
    CREATE TABLE IF NOT EXISTS crawl_runs_v2 (
      id TEXT PRIMARY KEY,
      sourceId TEXT NOT NULL REFERENCES sources_v2(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','partially-failed')),
      startedAt TEXT NOT NULL DEFAULT (datetime('now')),
      completedAt TEXT DEFAULT '',
      grantsFound INTEGER DEFAULT 0,
      grantsNew INTEGER DEFAULT 0,
      grantsUpdated INTEGER DEFAULT 0,
      errorMessage TEXT DEFAULT '',
      logPath TEXT DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_crawl_runs_v2_sourceId ON crawl_runs_v2(sourceId);
    CREATE INDEX IF NOT EXISTS idx_crawl_runs_v2_status ON crawl_runs_v2(status);

    -- 2.5 Funder Profiles (typed)
    CREATE TABLE IF NOT EXISTS funder_profiles_v2 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      shortName TEXT DEFAULT '',
      type TEXT DEFAULT 'foundation' CHECK(type IN ('foundation','government','corporate','community','other')),
      website TEXT DEFAULT '',
      missionStatement TEXT DEFAULT '',
      focusAreas TEXT DEFAULT '[]',
      geographicFocus TEXT DEFAULT '',
      averageAwardSize TEXT DEFAULT '',
      awardRange TEXT DEFAULT '',
      deadlinePattern TEXT DEFAULT '',
      applicationUrl TEXT DEFAULT '',
      contactEmail TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      confidenceScore REAL DEFAULT 0,
      dataSource TEXT DEFAULT '',
      lastUpdated TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_funder_profiles_v2_type ON funder_profiles_v2(type);
    CREATE INDEX IF NOT EXISTS idx_funder_profiles_v2_name ON funder_profiles_v2(name);

    -- 2.6 Pipeline Transitions
    CREATE TABLE IF NOT EXISTS pipeline_transitions (
      id TEXT PRIMARY KEY,
      grantId TEXT NOT NULL,
      fromState TEXT NOT NULL,
      toState TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pipeline_transitions_grantId ON pipeline_transitions(grantId);
    CREATE INDEX IF NOT EXISTS idx_pipeline_transitions_createdAt ON pipeline_transitions(createdAt);

    -- 2.7 Tasks (typed)
    CREATE TABLE IF NOT EXISTS tasks_v2 (
      id TEXT PRIMARY KEY,
      grantId TEXT DEFAULT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'blocked' CHECK(status IN ('blocked','in-progress','completed','waived','not-applicable')),
      responsibility TEXT DEFAULT '' CHECK(responsibility IN ('finance','program','review','follow-up','')),
      dueDate TEXT DEFAULT '',
      completedAt TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_v2_grantId ON tasks_v2(grantId);
    CREATE INDEX IF NOT EXISTS idx_tasks_v2_status ON tasks_v2(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_v2_dueDate ON tasks_v2(dueDate);
    CREATE INDEX IF NOT EXISTS idx_tasks_v2_responsibility ON tasks_v2(responsibility);

    -- 2.8 Documents (typed)
    CREATE TABLE IF NOT EXISTS documents_v2 (
      id TEXT PRIMARY KEY,
      grantId TEXT DEFAULT NULL,
      filename TEXT NOT NULL,
      mimeType TEXT DEFAULT '',
      sizeBytes INTEGER DEFAULT 0,
      sha256 TEXT DEFAULT '',
      storagePath TEXT DEFAULT '',
      extractionStatus TEXT DEFAULT 'pending' CHECK(extractionStatus IN ('pending','extracting','extracted','failed')),
      extractionError TEXT DEFAULT '',
      extractedText TEXT DEFAULT '',
      uploadedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_documents_v2_grantId ON documents_v2(grantId);
    CREATE INDEX IF NOT EXISTS idx_documents_v2_extractionStatus ON documents_v2(extractionStatus);

    -- 2.9 Draft Versions
    CREATE TABLE IF NOT EXISTS draft_versions (
      id TEXT PRIMARY KEY,
      grantId TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL DEFAULT '',
      groundingStatus TEXT DEFAULT 'ungrounded' CHECK(groundingStatus IN ('ungrounded','grounding','grounded','failed')),
      groundingSources TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      createdBy TEXT DEFAULT 'agent'
    );
    CREATE INDEX IF NOT EXISTS idx_draft_versions_grantId ON draft_versions(grantId);
    CREATE INDEX IF NOT EXISTS idx_draft_versions_version ON draft_versions(grantId, version);

    -- 2.10 Snippets
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      grantId TEXT DEFAULT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      category TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_snippets_grantId ON snippets(grantId);
    CREATE INDEX IF NOT EXISTS idx_snippets_category ON snippets(category);

    -- 2.11 Application Form Templates
    CREATE TABLE IF NOT EXISTS application_form_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      funderId TEXT DEFAULT NULL,
      fields TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_form_templates_funderId ON application_form_templates(funderId);

    -- 2.12 Outreach Records
    CREATE TABLE IF NOT EXISTS outreach_records (
      id TEXT PRIMARY KEY,
      grantId TEXT NOT NULL,
      funderId TEXT DEFAULT NULL,
      contactName TEXT DEFAULT '',
      contactEmail TEXT DEFAULT '',
      method TEXT DEFAULT 'email' CHECK(method IN ('email','phone','meeting','other')),
      notes TEXT DEFAULT '',
      outcome TEXT DEFAULT '' CHECK(outcome IN ('','no-response','positive','negative','follow-up-needed')),
      followUpDate TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_outreach_grantId ON outreach_records(grantId);
    CREATE INDEX IF NOT EXISTS idx_outreach_funderId ON outreach_records(funderId);

    -- 2.13 Awards
    CREATE TABLE IF NOT EXISTS awards_v2 (
      id TEXT PRIMARY KEY,
      grantId TEXT NOT NULL UNIQUE,
      funder TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL DEFAULT 0,
      startDate TEXT DEFAULT '',
      endDate TEXT DEFAULT '',
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','terminated','pending')),
      awardLetterPath TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_awards_v2_grantId ON awards_v2(grantId);
    CREATE INDEX IF NOT EXISTS idx_awards_v2_status ON awards_v2(status);

    -- 2.14 Award Budget Categories
    CREATE TABLE IF NOT EXISTS award_budget_categories_v2 (
      id TEXT PRIMARY KEY,
      awardId TEXT NOT NULL REFERENCES awards_v2(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      budgetedAmount REAL DEFAULT 0,
      displayOrder INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_award_budget_categories_awardId ON award_budget_categories_v2(awardId);

    -- 2.15 Award Expenses
    CREATE TABLE IF NOT EXISTS award_expenses_v2 (
      id TEXT PRIMARY KEY,
      awardId TEXT NOT NULL REFERENCES awards_v2(id) ON DELETE CASCADE,
      categoryId TEXT DEFAULT NULL,
      description TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL DEFAULT '',
      isPlanned INTEGER DEFAULT 0,
      receiptPath TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_award_expenses_awardId ON award_expenses_v2(awardId);
    CREATE INDEX IF NOT EXISTS idx_award_expenses_categoryId ON award_expenses_v2(categoryId);

    -- 2.16 Award Report Deadlines
    CREATE TABLE IF NOT EXISTS award_report_deadlines_v2 (
      id TEXT PRIMARY KEY,
      awardId TEXT NOT NULL REFERENCES awards_v2(id) ON DELETE CASCADE,
      reportType TEXT NOT NULL DEFAULT '',
      dueDate TEXT NOT NULL DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','submitted','overdue')),
      submittedAt TEXT DEFAULT '',
      submittedBy TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_award_report_deadlines_awardId ON award_report_deadlines_v2(awardId);
    CREATE INDEX IF NOT EXISTS idx_award_report_deadlines_status ON award_report_deadlines_v2(status);

    -- 2.17 Award Compliance Items
    CREATE TABLE IF NOT EXISTS award_compliance_items_v2 (
      id TEXT PRIMARY KEY,
      awardId TEXT NOT NULL REFERENCES awards_v2(id) ON DELETE CASCADE,
      requirement TEXT NOT NULL DEFAULT '',
      dueDate TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','completed','overdue','waived')),
      completedAt TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_award_compliance_awardId ON award_compliance_items_v2(awardId);

    -- 2.18 Activity Events
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      eventType TEXT NOT NULL,
      entityType TEXT NOT NULL DEFAULT '',
      entityId TEXT NOT NULL DEFAULT '',
      actor TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      metadata TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_activity_events_type ON activity_events(eventType);
    CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON activity_events(entityType, entityId);
    CREATE INDEX IF NOT EXISTS idx_activity_events_createdAt ON activity_events(createdAt);

    -- 2.19 Saved Searches (typed)
    CREATE TABLE IF NOT EXISTS saved_searches_v2 (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      queryText TEXT DEFAULT '',
      filters TEXT DEFAULT '{}',
      newResultsCount INTEGER DEFAULT 0,
      lastCheckedAt TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2.20 Settings (typed key-value)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2.21 Agent Jobs (typed)
    CREATE TABLE IF NOT EXISTS agent_jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'research' CHECK(type IN ('research','draft','crawl','match','extract','peer-discovery','funder-insights','eligibility-vetting','budget-import','pattern-detection')),
      grantId TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','verifying','retrying','completed','failed','cancelled')),
      retryCount INTEGER DEFAULT 0,
      maxRetries INTEGER DEFAULT 3,
      progress INTEGER DEFAULT 0,
      progressStage TEXT DEFAULT '',
      processPid INTEGER DEFAULT NULL,
      processStartedAt TEXT DEFAULT '',
      artifactPath TEXT DEFAULT '',
      errorMessage TEXT DEFAULT '',
      qualityWarning INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON agent_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_type ON agent_jobs(type);

    -- 2.22 Schema Migrations
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2.23 Backup Schedule
    CREATE TABLE IF NOT EXISTS backup_schedule (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      enabled INTEGER DEFAULT 0,
      intervalHours INTEGER DEFAULT 168,
      maxBackups INTEGER DEFAULT 10,
      lastBackupAt TEXT DEFAULT '',
      lastBackupPath TEXT DEFAULT '',
      lastBackupChecksum TEXT DEFAULT '',
      lastBackupVerified INTEGER DEFAULT 0,
      nextBackupAt TEXT DEFAULT ''
    );
  `);
}

function readJsonFile<T>(filePath: string): Promise<T | null> {
	return fs
		.readFile(filePath, "utf8")
		.then((raw: string) => JSON.parse(raw) as T)
		.catch(() => null);
}

async function readLegacyBootstrap(state: SqliteBootstrapState): Promise<{
	grants?: Grant[];
	profile?: OrganizationProfile;
	persisted?: PersistedData | null;
	standaloneOpencode?: OpencodeSettings | null;
}> {
	const grants = await readJsonFile<Grant[]>(
		path.join(state.dataDir, "grants.json"),
	);
	const profile = await readJsonFile<OrganizationProfile>(
		path.join(state.dataDir, "profile.json"),
	);
	const persisted = await readJsonFile<PersistedData>(
		path.join(state.dataDir, "persisted-data.json"),
	);
	const standaloneOpencode = await readJsonFile<OpencodeSettings>(
		path.join(state.dataDir, "opencode-settings.json"),
	);
	const result: {
		grants?: Grant[];
		profile?: OrganizationProfile;
		persisted?: PersistedData | null;
		standaloneOpencode?: OpencodeSettings | null;
	} = {};
	if (grants) result.grants = grants;
	if (profile) result.profile = profile;
	if (persisted) result.persisted = persisted;
	if (standaloneOpencode) result.standaloneOpencode = standaloneOpencode;
	return result;
}

function hasAnyRows(db: SqliteDatabase): boolean {
	const tables = [
		"grants",
		"sources",
		"crawl_runs",
		"draft_artifacts",
		"revision_requests",
		"approval_records",
		"submission_records",
		"follow_ups",
		"notifications",
		"tasks",
		"documents",
		"profile",
		"opencode_settings",
		"funder_profiles",
	];
	return tables.some(
		(table) => db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get() !== undefined,
	);
}

function replaceTable<T extends { id: string }>(
	db: SqliteDatabase,
	table: string,
	rows: T[],
): void {
	const deleteStmt = db.prepare(`DELETE FROM ${table}`);
	const insertStmt = db.prepare(
		`INSERT INTO ${table} (id, json) VALUES (@id, @json)`,
	);
	const tx = db.transaction((items: T[]) => {
		deleteStmt.run();
		const uniqueItems = Array.from(
			new Map(items.map((item) => [item.id, item])).values(),
		);
		for (const item of uniqueItems) {
			insertStmt.run({ id: item.id, json: JSON.stringify(item) });
		}
	});
	tx(rows);
	incrementWriteCounterForDb(db);
}

function loadTable<T>(db: SqliteDatabase, table: string): T[] {
	const rows = db
		.prepare(`SELECT json FROM ${table} ORDER BY rowid ASC`)
		.all() as Array<{ json: string }>;
	return rows.map((row) => JSON.parse(row.json) as T);
}

function loadSingleton<T>(
	db: SqliteDatabase,
	table: string,
	id: string,
): T | null {
	const row = db
		.prepare(`SELECT json FROM ${table} WHERE id = ? LIMIT 1`)
		.get(id) as { json: string } | undefined;
	return row ? (JSON.parse(row.json) as T) : null;
}

function saveSingleton<T>(
	db: SqliteDatabase,
	table: string,
	id: string,
	row: T | null,
): void {
	const deleteStmt = db.prepare(`DELETE FROM ${table}`);
	if (!row) {
		deleteStmt.run();
		incrementWriteCounterForDb(db);
		return;
	}
	db.prepare(`INSERT OR REPLACE INTO ${table} (id, json) VALUES (?, ?)`).run(
		id,
		JSON.stringify(row),
	);
	incrementWriteCounterForDb(db);
}

function saveMeta(db: SqliteDatabase, key: string, value: string): void {
	db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(
		key,
		value,
	);
	incrementWriteCounterForDb(db);
}

function loadMeta(db: SqliteDatabase, key: string): string | null {
	const row = db
		.prepare("SELECT value FROM meta WHERE key = ? LIMIT 1")
		.get(key) as { value: string } | undefined;
	return row?.value ?? null;
}

function seedDefaultState(db: SqliteDatabase): void {
	replaceTable<Grant>(db, "grants", []);
	saveSingleton<OrganizationProfile>(db, "profile", "profile", defaultProfile);
	replaceTable<Notification>(db, "notifications", []);
	replaceTable<Task>(db, "tasks", []);
	replaceTable<Source>(db, "sources", SEED_SOURCES);
	replaceTable<CrawlRun>(db, "crawl_runs", []);
	replaceTable<DraftArtifact>(db, "draft_artifacts", []);
	replaceTable<RevisionRequest>(db, "revision_requests", []);
	replaceTable<ApprovalRecord>(db, "approval_records", []);
	replaceTable<SubmissionRecord>(db, "submission_records", []);
	replaceTable<FollowUp>(db, "follow_ups", []);
	replaceTable<DocumentMetadata>(db, "documents", []);
	replaceTable<FunderProfile>(db, "funder_profiles", SEED_FUNDERS);
	replaceTable<SavedSearch>(db, "saved_searches", []);
	replaceTable<CrawlSchedule>(db, "crawl_schedules", SEED_SCHEDULES);
	saveSingleton<OpencodeSettings>(
		db,
		"opencode_settings",
		"opencode_settings",
		defaultOpencodeSettings,
	);
	saveMeta(db, "lastSync", new Date().toISOString());
}

function bootstrapFromLegacy(
	db: SqliteDatabase,
	legacy: Awaited<ReturnType<typeof readLegacyBootstrap>>,
): void {
	if (legacy.grants) {
		replaceTable<Grant>(
			db,
			"grants",
			legacy.grants.map((grant) => normalizeGrantDetailFields(grant)),
		);
	}

	if (legacy.profile) {
		saveSingleton<OrganizationProfile>(
			db,
			"profile",
			"profile",
			legacy.profile,
		);
	} else {
		saveSingleton<OrganizationProfile>(
			db,
			"profile",
			"profile",
			defaultProfile,
		);
	}

	replaceTable<Source>(db, "sources", legacy.persisted?.sources ?? []);
	replaceTable<CrawlRun>(db, "crawl_runs", legacy.persisted?.crawlRuns ?? []);
	replaceTable<DraftArtifact>(
		db,
		"draft_artifacts",
		legacy.persisted?.draftArtifacts ?? [],
	);
	replaceTable<RevisionRequest>(
		db,
		"revision_requests",
		legacy.persisted?.revisionRequests ?? [],
	);
	replaceTable<ApprovalRecord>(
		db,
		"approval_records",
		legacy.persisted?.approvalRecords ?? [],
	);
	replaceTable<SubmissionRecord>(
		db,
		"submission_records",
		legacy.persisted?.submissionRecords ?? [],
	);
	replaceTable<FollowUp>(db, "follow_ups", legacy.persisted?.followUps ?? []);
	replaceTable<Notification>(
		db,
		"notifications",
		legacy.persisted?.notifications ?? [],
	);
	replaceTable<Task>(db, "tasks", legacy.persisted?.tasks ?? []);
	replaceTable<DocumentMetadata>(
		db,
		"documents",
		legacy.persisted?.documents ?? [],
	);

	const opencodeSettings =
		legacy.standaloneOpencode ??
		legacy.persisted?.opencodeSettings ??
		defaultOpencodeSettings;
	saveSingleton<OpencodeSettings>(
		db,
		"opencode_settings",
		"opencode_settings",
		opencodeSettings,
	);
	saveMeta(
		db,
		"lastSync",
		legacy.persisted?.lastSync ?? new Date().toISOString(),
	);

	const existingFunders = loadTable<FunderProfile>(db, 'funder_profiles');
	if (existingFunders.length === 0) {
		replaceTable<FunderProfile>(db, 'funder_profiles', SEED_FUNDERS);
	}

	const existingSchedules = loadTable<CrawlSchedule>(db, 'crawl_schedules');
	if (existingSchedules.length === 0) {
		replaceTable<CrawlSchedule>(db, 'crawl_schedules', SEED_SCHEDULES);
	}
}

function ensureBootstrapped(state: SqliteBootstrapState): SqliteDatabase {
	const db = openDatabase(state);
	ensureSchema(db);
	runMigrations(state);

	if (initialized.has(state.dataDir)) {
		return db;
	}

	if (hasAnyRows(db)) {
		initialized.add(state.dataDir);
		return db;
	}

	return db;
}

export async function getBootstrappedDatabase(
	state: SqliteBootstrapState,
): Promise<SqliteDatabase> {
	const db = ensureBootstrapped(state);
	if (initialized.has(state.dataDir)) {
		return db;
	}

	const legacy = await readLegacyBootstrap(state);
	const hasLegacy = Boolean(
		legacy.grants ||
			legacy.profile ||
			legacy.persisted ||
			legacy.standaloneOpencode,
	);

	if (hasLegacy) {
		bootstrapFromLegacy(db, legacy);
	} else {
		seedDefaultState(db);
	}

	initialized.add(state.dataDir);
	return db;
}

export async function readPersistedData(
	state: SqliteBootstrapState,
): Promise<PersistedData> {
	const db = await getBootstrappedDatabase(state);
	return {
		sources: loadTable<Source>(db, "sources"),
		crawlRuns: loadTable<CrawlRun>(db, "crawl_runs"),
		draftArtifacts: loadTable<DraftArtifact>(db, "draft_artifacts"),
		revisionRequests: loadTable<RevisionRequest>(db, "revision_requests"),
		approvalRecords: loadTable<ApprovalRecord>(db, "approval_records"),
		submissionRecords: loadTable<SubmissionRecord>(db, "submission_records"),
		followUps: loadTable<FollowUp>(db, "follow_ups"),
		opencodeSettings: loadSingleton<OpencodeSettings>(
			db,
			"opencode_settings",
			"opencode_settings",
		),
		notifications: loadTable<Notification>(db, "notifications"),
		tasks: loadTable<Task>(db, "tasks"),
		documents: loadTable<DocumentMetadata>(db, "documents"),
		lastSync: loadMeta(db, "lastSync") ?? new Date().toISOString(),
	};
}

export async function writePersistedData(
	state: SqliteBootstrapState,
	data: PersistedData,
): Promise<void> {
	const db = await getBootstrappedDatabase(state);
	replaceTable<Source>(db, "sources", data.sources);
	replaceTable<CrawlRun>(db, "crawl_runs", data.crawlRuns);
	replaceTable<DraftArtifact>(db, "draft_artifacts", data.draftArtifacts);
	replaceTable<RevisionRequest>(db, "revision_requests", data.revisionRequests);
	replaceTable<ApprovalRecord>(db, "approval_records", data.approvalRecords);
	replaceTable<SubmissionRecord>(
		db,
		"submission_records",
		data.submissionRecords,
	);
	replaceTable<FollowUp>(db, "follow_ups", data.followUps);
	replaceTable<Notification>(db, "notifications", data.notifications);
	replaceTable<Task>(db, "tasks", data.tasks);
	replaceTable<DocumentMetadata>(db, "documents", data.documents);
	if (data.opencodeSettings != null) {
		saveSingleton<OpencodeSettings>(
			db,
			"opencode_settings",
			"opencode_settings",
			data.opencodeSettings,
		);
	}
	saveMeta(db, "lastSync", data.lastSync);
}

export async function readGrants(
	state: SqliteBootstrapState,
): Promise<Grant[]> {
	const db = await getBootstrappedDatabase(state);
	return loadTable<Grant>(db, "grants").map((grant) =>
		normalizeGrantDetailFields(grant),
	);
}

export async function writeGrants(
	state: SqliteBootstrapState,
	grants: Grant[],
): Promise<void> {
	const db = await getBootstrappedDatabase(state);
	replaceTable<Grant>(
		db,
		"grants",
		grants.map((grant) => normalizeGrantDetailFields(grant)),
	);
}

export async function readProfile(
	state: SqliteBootstrapState,
): Promise<OrganizationProfile> {
	const db = await getBootstrappedDatabase(state);
	return (
		loadSingleton<OrganizationProfile>(db, "profile", "profile") ?? {
			...defaultProfile,
		}
	);
}

export async function writeProfile(
	state: SqliteBootstrapState,
	profile: OrganizationProfile,
): Promise<void> {
	const db = await getBootstrappedDatabase(state);
	saveSingleton<OrganizationProfile>(db, "profile", "profile", profile);
}

export async function readOpencodeSettings(
	state: SqliteBootstrapState,
): Promise<OpencodeSettings | null> {
	const db = await getBootstrappedDatabase(state);
	return loadSingleton<OpencodeSettings>(
		db,
		"opencode_settings",
		"opencode_settings",
	);
}

export async function writeOpencodeSettings(
	state: SqliteBootstrapState,
	settings: OpencodeSettings,
): Promise<void> {
	const db = await getBootstrappedDatabase(state);
	saveSingleton<OpencodeSettings>(
		db,
		"opencode_settings",
		"opencode_settings",
		settings,
	);
}

export async function clearDatabase(
	state: SqliteBootstrapState,
): Promise<void> {
	resetSqliteCache(state.dataDir);
	initialized.delete(state.dataDir);
	await Promise.all(
		[
			state.dbPath,
			`${state.dbPath}-wal`,
			`${state.dbPath}-shm`,
			`${state.dbPath}-journal`,
		].map((filePath) => fs.rm(filePath, { force: true })),
	);
	await fs.rm(state.documentsDir, { recursive: true, force: true });
}

export const CURRENT_SCHEMA_VERSION = 2;

export function getCurrentSchemaVersion(state: SqliteBootstrapState): number {
	const db = openDatabase(state);
	const row = db.prepare("SELECT version FROM schema_version WHERE id = 1 LIMIT 1").get() as
		| { version: number }
		| undefined;
	return row?.version ?? 0;
}

export function setSchemaVersion(state: SqliteBootstrapState, version: number): void {
	const db = openDatabase(state);
	db.prepare(
		"INSERT OR REPLACE INTO schema_version (id, version, migrated_at) VALUES (1, ?, ?)",
	).run(version, new Date().toISOString());
	incrementWriteCounterForDb(db);
}

export function runMigrations(
	state: SqliteBootstrapState,
	options?: { applyMigration?: (currentVersion: number) => void },
): {
	success: boolean;
	version: number;
	message?: string;
} {
	try {
		const currentVersion = getCurrentSchemaVersion(state);
		if (currentVersion < CURRENT_SCHEMA_VERSION) {
			const backupPath = `${state.dbPath}.backup-${Date.now()}-v${currentVersion}`;
			try {
				copyFileSync(state.dbPath, backupPath);
			} catch {
				// best effort backup before migration
			}

			const db = openDatabase(state);
			db.prepare('SAVEPOINT pre_migration').run();
			try {
				if (options?.applyMigration) {
					options.applyMigration(currentVersion);
				} else {
					setSchemaVersion(state, CURRENT_SCHEMA_VERSION);
				}
				db.prepare('RELEASE SAVEPOINT pre_migration').run();
			} catch (migrationError) {
				db.prepare('ROLLBACK TO SAVEPOINT pre_migration').run();
				throw migrationError;
			}
		}
		return { success: true, version: CURRENT_SCHEMA_VERSION };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Migration failed";
		return { success: false, version: getCurrentSchemaVersion(state), message };
	}
}

export function readAuditEvents(
	state: SqliteBootstrapState,
	limit?: number,
): AuditEvent[] {
	const db = openDatabase(state);
	const sql = limit
		? "SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT ?"
		: "SELECT * FROM audit_events ORDER BY timestamp DESC";
	const rows = limit ? db.prepare(sql).all(limit) : db.prepare(sql).all();
	return (rows as Array<Record<string, unknown>>).map((row) => {
		const event: AuditEvent = {
			id: String(row.id),
			eventType: String(row.event_type),
			entityId: String(row.entity_id),
			entityType: String(row.entity_type),
			actorLabel: String(row.actor_label),
			timestamp: String(row.timestamp),
		};
		if (row.metadata) {
			event.metadata = JSON.parse(String(row.metadata)) as Record<string, unknown>;
		}
		return event;
	});
}

export function saveAuditEvent(state: SqliteBootstrapState, event: AuditEvent): void {
	const db = openDatabase(state);
	db.prepare(
		`INSERT OR REPLACE INTO audit_events (id, event_type, entity_id, entity_type, actor_label, timestamp, metadata)
		 VALUES (@id, @eventType, @entityId, @entityType, @actorLabel, @timestamp, @metadata)`,
	).run({
		...event,
		metadata: event.metadata ? JSON.stringify(event.metadata) : null,
	});
	incrementWriteCounterForDb(db);
}

export function readJobQueue(state: SqliteBootstrapState, status?: string): JobQueueItem[] {
	const db = openDatabase(state);
	const rows = db.prepare("SELECT * FROM job_queue ORDER BY created_at DESC").all() as Array<Record<string, unknown>>;
	const items = rows.map((row) => {
		const item: JobQueueItem = {
			id: String(row.id),
			jobType: String(row.job_type) as JobQueueItem['jobType'],
			status: String(row.status) as JobQueueItem['status'],
			createdAt: String(row.created_at),
			retryCount: typeof row.retry_count === 'number' ? row.retry_count : Number(row.retry_count ?? 0),
		};
		if (row.stage) item.stage = String(row.stage);
		if (row.last_update) item.lastUpdate = String(row.last_update);
		if (row.started_at) item.startedAt = String(row.started_at);
		if (row.completed_at) item.completedAt = String(row.completed_at);
		if (row.entity_id) item.entityId = String(row.entity_id);
		if (row.error_message) item.errorMessage = String(row.error_message);
		if (row.result_summary) item.resultSummary = String(row.result_summary);
		if (row.failure_category) item.failureCategory = String(row.failure_category) as JobFailureCategory;
		return item;
	});
	return status ? items.filter((item) => item.status === status) : items;
}

export function readJobQueueItem(state: SqliteBootstrapState, id: string): JobQueueItem | null {
	return readJobQueue(state).find((item) => item.id === id) ?? null;
}

export function writeJobQueueItem(state: SqliteBootstrapState, item: JobQueueItem): void {
	const db = openDatabase(state);
	db.prepare(
		`INSERT OR REPLACE INTO job_queue (id, job_type, status, stage, last_update, created_at, started_at, completed_at, entity_id, retry_count, error_message, result_summary, failure_category)
		 VALUES (@id, @jobType, @status, @stage, @lastUpdate, @createdAt, @startedAt, @completedAt, @entityId, @retryCount, @errorMessage, @resultSummary, @failureCategory)`,
	).run({
		id: item.id,
		jobType: item.jobType,
		status: item.status,
		stage: item.stage ?? null,
		lastUpdate: item.lastUpdate ?? null,
		createdAt: item.createdAt,
		startedAt: item.startedAt ?? null,
		completedAt: item.completedAt ?? null,
		entityId: item.entityId ?? null,
		retryCount: item.retryCount ?? 0,
		errorMessage: item.errorMessage ?? null,
		resultSummary: item.resultSummary ?? null,
		failureCategory: item.failureCategory ?? null,
	});
	incrementWriteCounterForDb(db);
}

export function saveJobQueueItem(state: SqliteBootstrapState, item: JobQueueItem): void {
	writeJobQueueItem(state, item);
}

export function updateJobQueueItem(state: SqliteBootstrapState, id: string, updates: Partial<JobQueueItem>): void {
	const existing = readJobQueueItem(state, id);
	if (!existing) return;
	writeJobQueueItem(state, { ...existing, ...updates, id });
}

export function readDuplicateCandidates(state: SqliteBootstrapState, status?: string): DuplicateCandidate[] {
	const db = openDatabase(state);
	const rows = db.prepare("SELECT * FROM duplicate_candidates ORDER BY detected_at DESC").all() as Array<Record<string, unknown>>;
	const items = rows.map((row) => {
		const item: DuplicateCandidate = {
			id: String(row.id),
			grantId1: String(row.grant_id1),
			grantId2: String(row.grant_id2),
			confidenceScore: Number(row.confidence_score),
			status: String(row.status) as DuplicateCandidate['status'],
			detectedAt: String(row.detected_at),
			conflictingFields: JSON.parse(String(row.conflicting_fields)) as string[],
		};
		if (row.resolved_at) item.resolvedAt = String(row.resolved_at);
		if (row.resolved_by) item.resolvedBy = String(row.resolved_by);
		return item;
	});
	return status ? items.filter((item) => item.status === status) : items;
}

export function saveDuplicateCandidate(state: SqliteBootstrapState, item: DuplicateCandidate): void {
	const db = openDatabase(state);
	db.prepare(
		`INSERT OR REPLACE INTO duplicate_candidates (id, grant_id1, grant_id2, confidence_score, status, detected_at, conflicting_fields, resolved_at, resolved_by)
		 VALUES (@id, @grantId1, @grantId2, @confidenceScore, @status, @detectedAt, @conflictingFields, @resolvedAt, @resolvedBy)`,
	).run({
		id: item.id,
		grantId1: item.grantId1,
		grantId2: item.grantId2,
		confidenceScore: item.confidenceScore,
		status: item.status,
		detectedAt: item.detectedAt,
		conflictingFields: JSON.stringify(item.conflictingFields),
		resolvedAt: item.resolvedAt ?? null,
		resolvedBy: item.resolvedBy ?? null,
	});
	incrementWriteCounterForDb(db);
}

export function updateDuplicateCandidate(state: SqliteBootstrapState, id: string, updates: Partial<DuplicateCandidate>): void {
	const existing = readDuplicateCandidates(state).find((item) => item.id === id);
	if (!existing) return;
	saveDuplicateCandidate(state, { ...existing, ...updates, id });
}

export function readConflictRecords(state: SqliteBootstrapState, grantId?: string): ConflictRecord[] {
	const db = openDatabase(state);
	const rows = db.prepare("SELECT * FROM conflict_records ORDER BY field_name ASC").all() as Array<Record<string, unknown>>;
	const items = rows.map((row) => {
		const item: ConflictRecord = {
			id: String(row.id),
			grantId: String(row.grant_id),
			fieldName: String(row.field_name),
			values: JSON.parse(String(row.values_json)) as ConflictRecord['values'],
		};
		if (row.canonical_value) item.canonicalValue = String(row.canonical_value);
		if (row.resolved_at) item.resolvedAt = String(row.resolved_at);
		if (row.resolved_by) item.resolvedBy = String(row.resolved_by);
		return item;
	});
	return grantId ? items.filter((item) => item.grantId === grantId) : items;
}

export function saveConflictRecord(state: SqliteBootstrapState, item: ConflictRecord): void {
	const db = openDatabase(state);
	db.prepare(
		`INSERT OR REPLACE INTO conflict_records (id, grant_id, field_name, values_json, canonical_value, resolved_at, resolved_by)
		 VALUES (@id, @grantId, @fieldName, @valuesJson, @canonicalValue, @resolvedAt, @resolvedBy)`,
	).run({
		id: item.id,
		grantId: item.grantId,
		fieldName: item.fieldName,
		valuesJson: JSON.stringify(item.values),
		canonicalValue: item.canonicalValue ?? null,
		resolvedAt: item.resolvedAt ?? null,
		resolvedBy: item.resolvedBy ?? null,
	});
	incrementWriteCounterForDb(db);
}

export function updateConflictRecord(state: SqliteBootstrapState, id: string, updates: Partial<ConflictRecord>): void {
	const existing = readConflictRecords(state).find((item) => item.id === id);
	if (!existing) return;
	saveConflictRecord(state, { ...existing, ...updates, id });
}

export function readSubmissionManifests(state: SqliteBootstrapState, grantId?: string): SubmissionManifest[] {
	const db = openDatabase(state);
	const rows = db.prepare("SELECT * FROM submission_manifests ORDER BY created_at DESC").all() as Array<Record<string, unknown>>;
	const items = rows.map((row) => {
		const item: SubmissionManifest = {
			id: String(row.id),
			grantId: String(row.grant_id),
			version: Number(row.version),
			createdAt: String(row.created_at),
			updatedAt: String(row.updated_at),
			materialRefs: JSON.parse(String(row.material_refs)) as SubmissionManifest['materialRefs'],
		};
		if (row.instructions) item.instructions = String(row.instructions);
		if (row.portal_url) item.portalUrl = String(row.portal_url);
		if (row.file_constraints) item.fileConstraints = String(row.file_constraints);
		if (row.due_date) item.dueDate = String(row.due_date);
		if (row.notes) item.notes = String(row.notes);
		return item;
	});
	return grantId ? items.filter((item) => item.grantId === grantId) : items;
}

export function saveSubmissionManifest(state: SqliteBootstrapState, item: SubmissionManifest): void {
	const db = openDatabase(state);
	db.prepare(
		`INSERT OR REPLACE INTO submission_manifests (id, grant_id, version, created_at, updated_at, instructions, portal_url, file_constraints, due_date, material_refs, notes)
		 VALUES (@id, @grantId, @version, @createdAt, @updatedAt, @instructions, @portalUrl, @fileConstraints, @dueDate, @materialRefs, @notes)`,
	).run({
		id: item.id,
		grantId: item.grantId,
		version: item.version,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
		instructions: item.instructions ?? null,
		portalUrl: item.portalUrl ?? null,
		fileConstraints: item.fileConstraints ?? null,
		dueDate: item.dueDate ?? null,
		materialRefs: JSON.stringify(item.materialRefs),
		notes: item.notes ?? null,
	});
	incrementWriteCounterForDb(db);
}

export function removeApprovalRecordByGrantId(state: SqliteBootstrapState, grantId: string): void {
	const db = openDatabase(state);
	const records = loadTable<ApprovalRecord>(db, 'approval_records').filter((record) => record.grantId !== grantId);
	replaceTable<ApprovalRecord>(db, 'approval_records', records);
}

export function readCrawlSchedules(state: SqliteBootstrapState): CrawlSchedule[] {
	const db = openDatabase(state);
	return loadTable<CrawlSchedule>(db, 'crawl_schedules');
}

export function upsertCrawlSchedule(state: SqliteBootstrapState, schedule: CrawlSchedule): void {
	const db = openDatabase(state);
	const schedules = readCrawlSchedules(state).filter((item) => item.id !== schedule.id);
	schedules.push(schedule);
	replaceTable<CrawlSchedule>(db, 'crawl_schedules', schedules);
	incrementWriteCounterForDb(db);
}

export function deleteCrawlSchedule(state: SqliteBootstrapState, id: string): void {
	const db = openDatabase(state);
	const schedules = readCrawlSchedules(state).filter((schedule) => schedule.id !== id);
	replaceTable<CrawlSchedule>(db, 'crawl_schedules', schedules);
	incrementWriteCounterForDb(db);
}

function readJsonMeta<T>(db: SqliteDatabase, key: string): T | null {
	const raw = loadMeta(db, key);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export function readBackupFreshness(state: SqliteBootstrapState): BackupFreshnessStatus {
	const db = openDatabase(state);
	return {
		lastBackupAt: loadMeta(db, 'lastBackupAt') || null,
		isStale: loadMeta(db, 'backupIsStale') === 'true',
		lastBackupVerification: readJsonMeta<BackupVerificationRecord>(db, 'lastBackupVerification'),
		lastRestoreVerification: readJsonMeta<BackupVerificationRecord>(db, 'lastRestoreVerification'),
	};
}

export function saveBackupVerificationRecord(state: SqliteBootstrapState, record: BackupVerificationRecord): void {
	const db = openDatabase(state);
	const key = record.type === 'backup' ? 'lastBackupVerification' : 'lastRestoreVerification';
	saveMeta(db, key, JSON.stringify(record));
	if (record.type === 'backup') {
		saveMeta(db, 'lastBackupAt', record.checkedAt);
		saveMeta(db, 'backupIsStale', 'false');
	}
}

export function saveBackupFreshness(state: SqliteBootstrapState, freshness: BackupFreshnessStatus): void {
	const db = openDatabase(state);
	if (freshness.lastBackupAt === null) {
		saveMeta(db, 'lastBackupAt', '');
	} else {
		saveMeta(db, 'lastBackupAt', freshness.lastBackupAt);
	}
	saveMeta(db, 'backupIsStale', freshness.isStale ? 'true' : 'false');
	if (freshness.lastBackupVerification) {
		saveMeta(db, 'lastBackupVerification', JSON.stringify(freshness.lastBackupVerification));
	}
	if (freshness.lastRestoreVerification) {
		saveMeta(db, 'lastRestoreVerification', JSON.stringify(freshness.lastRestoreVerification));
	}
}

// ============ THEMES DATA PERSISTENCE ============

function defaultThemesData(): ThemesData {
	return {
		keywordClusters: [],
		themes: [],
		regions: [],
		populations: [],
		strategicPriorities: [],
	};
}

export function readThemesData(state: SqliteBootstrapState): ThemesData {
	const db = openDatabase(state);
	const row = db
		.prepare("SELECT json FROM themes_data WHERE id = 'themes_data' LIMIT 1")
		.get() as { json: string } | undefined;
	if (!row) return defaultThemesData();
	try {
		return JSON.parse(row.json) as ThemesData;
	} catch {
		return defaultThemesData();
	}
}

export function writeThemesData(state: SqliteBootstrapState, data: ThemesData): void {
	const db = openDatabase(state);
	db.prepare("INSERT OR REPLACE INTO themes_data (id, json) VALUES ('themes_data', ?)").run(
		JSON.stringify(data),
	);
	incrementWriteCounterForDb(db);
}

export function readFunderProfiles(state: SqliteBootstrapState): FunderProfile[] {
	const db = openDatabase(state);
	return loadTable<FunderProfile>(db, 'funder_profiles');
}

export function writeFunderProfiles(state: SqliteBootstrapState, profiles: FunderProfile[]): void {
	const db = openDatabase(state);
	replaceTable<FunderProfile>(db, 'funder_profiles', profiles);
}

export function readSavedSearches(state: SqliteBootstrapState): SavedSearch[] {
	const db = openDatabase(state);
	return loadTable<SavedSearch>(db, 'saved_searches');
}

export function writeSavedSearches(state: SqliteBootstrapState, searches: SavedSearch[]): void {
	const db = openDatabase(state);
	replaceTable<SavedSearch>(db, 'saved_searches', searches);
}

export function readAwards(state: SqliteBootstrapState): Award[] {
	const db = openDatabase(state);
	return loadTable<Award>(db, 'awards');
}

export function writeAwards(state: SqliteBootstrapState, awards: Award[]): void {
	const db = openDatabase(state);
	replaceTable<Award>(db, 'awards', awards);
}

export function readAwardBudgetCategories(state: SqliteBootstrapState): AwardBudgetCategory[] {
	const db = openDatabase(state);
	return loadTable<AwardBudgetCategory>(db, 'award_budget_categories');
}

export function writeAwardBudgetCategories(state: SqliteBootstrapState, categories: AwardBudgetCategory[]): void {
	const db = openDatabase(state);
	replaceTable<AwardBudgetCategory>(db, 'award_budget_categories', categories);
}

export function readAwardExpenses(state: SqliteBootstrapState): AwardExpense[] {
	const db = openDatabase(state);
	return loadTable<AwardExpense>(db, 'award_expenses');
}

export function writeAwardExpenses(state: SqliteBootstrapState, expenses: AwardExpense[]): void {
	const db = openDatabase(state);
	replaceTable<AwardExpense>(db, 'award_expenses', expenses);
}

export function readPlannedExpenses(state: SqliteBootstrapState): PlannedExpense[] {
	const db = openDatabase(state);
	return loadTable<PlannedExpense>(db, 'planned_expenses');
}

export function writePlannedExpenses(state: SqliteBootstrapState, expenses: PlannedExpense[]): void {
	const db = openDatabase(state);
	replaceTable<PlannedExpense>(db, 'planned_expenses', expenses);
}

export function readAwardReportDeadlines(state: SqliteBootstrapState): AwardReportDeadline[] {
	const db = openDatabase(state);
	return loadTable<AwardReportDeadline>(db, 'award_report_deadlines');
}

export function writeAwardReportDeadlines(state: SqliteBootstrapState, deadlines: AwardReportDeadline[]): void {
	const db = openDatabase(state);
	replaceTable<AwardReportDeadline>(db, 'award_report_deadlines', deadlines);
}

export function readAwardComplianceItems(state: SqliteBootstrapState): AwardComplianceItem[] {
	const db = openDatabase(state);
	return loadTable<AwardComplianceItem>(db, 'award_compliance_items');
}

export function writeAwardComplianceItems(state: SqliteBootstrapState, items: AwardComplianceItem[]): void {
	const db = openDatabase(state);
	replaceTable<AwardComplianceItem>(db, 'award_compliance_items', items);
}

export function readDraftSnippets(state: SqliteBootstrapState): DraftSnippet[] {
	const db = openDatabase(state);
	return loadTable<DraftSnippet>(db, 'draft_snippets');
}

export function writeDraftSnippets(state: SqliteBootstrapState, snippets: DraftSnippet[]): void {
	const db = openDatabase(state);
	replaceTable<DraftSnippet>(db, 'draft_snippets', snippets);
}

export function readPeerDiscoveryResults(state: SqliteBootstrapState): PeerDiscoveryResult[] {
	const db = openDatabase(state);
	return loadTable<PeerDiscoveryResult>(db, 'peer_discovery_results');
}

export function writePeerDiscoveryResults(state: SqliteBootstrapState, results: PeerDiscoveryResult[]): void {
	const db = openDatabase(state);
	replaceTable<PeerDiscoveryResult>(db, 'peer_discovery_results', results);
}

// ============ PIPELINE TRANSITIONS (typed V2) ============

import type { PipelineTransition } from './types';

export function readPipelineTransitions(state: SqliteBootstrapState, grantId?: string): PipelineTransition[] {
	const db = openDatabase(state);
	const sql = grantId
		? "SELECT * FROM pipeline_transitions WHERE grantId = ? ORDER BY createdAt DESC"
		: "SELECT * FROM pipeline_transitions ORDER BY createdAt DESC";
	const rows = grantId
		? (db.prepare(sql).all(grantId) as Array<Record<string, unknown>>)
		: (db.prepare(sql).all() as Array<Record<string, unknown>>);
	return rows.map((row) => ({
		id: String(row.id),
		grantId: String(row.grantId),
		fromState: String(row.fromState),
		toState: String(row.toState),
		actor: String(row.actor),
		reason: row.reason ? String(row.reason) : '',
		timestamp: String(row.createdAt),
	}));
}

export function writePipelineTransition(state: SqliteBootstrapState, transition: PipelineTransition): void {
	const db = openDatabase(state);
	db.prepare(
		`INSERT INTO pipeline_transitions (id, grantId, fromState, toState, actor, reason, createdAt)
		 VALUES (@id, @grantId, @fromState, @toState, @actor, @reason, @timestamp)`
	).run({
		id: transition.id,
		grantId: transition.grantId,
		fromState: transition.fromState,
		toState: transition.toState,
		actor: transition.actor,
		reason: transition.reason ?? '',
		timestamp: transition.timestamp,
	});
	incrementWriteCounterForDb(db);
}

// ============ SNIPPETS (typed V2 table) ============

export function readSnippets(state: SqliteBootstrapState, grantId?: string): Array<{ id: string; grantId: string | null; title: string; content: string; category: string; createdAt: string }> {
	const db = openDatabase(state);
	const sql = grantId
		? "SELECT * FROM snippets WHERE grantId = ? ORDER BY createdAt DESC"
		: "SELECT * FROM snippets ORDER BY createdAt DESC";
	const rows = grantId
		? (db.prepare(sql).all(grantId) as Array<Record<string, unknown>>)
		: (db.prepare(sql).all() as Array<Record<string, unknown>>);
	return rows.map((row) => ({
		id: String(row.id),
		grantId: row.grantId ? String(row.grantId) : null,
		title: String(row.title),
		content: String(row.content),
		category: String(row.category),
		createdAt: String(row.createdAt),
	}));
}

export function writeSnippet(state: SqliteBootstrapState, snippet: { id: string; grantId?: string | null; title: string; content: string; category?: string; createdAt: string }): void {
	const db = openDatabase(state);
	db.prepare(
		`INSERT OR REPLACE INTO snippets (id, grantId, title, content, category, createdAt)
		 VALUES (@id, @grantId, @title, @content, @category, @createdAt)`
	).run({
		id: snippet.id,
		grantId: snippet.grantId ?? null,
		title: snippet.title,
		content: snippet.content,
		category: snippet.category ?? '',
		createdAt: snippet.createdAt,
	});
	incrementWriteCounterForDb(db);
}

export function deleteSnippet(state: SqliteBootstrapState, id: string): void {
	const db = openDatabase(state);
	db.prepare("DELETE FROM snippets WHERE id = ?").run(id);
	incrementWriteCounterForDb(db);
}

// ============ APPLICATION FORM TEMPLATES (typed V2) ============

export function readFormTemplates(state: SqliteBootstrapState): Array<{ id: string; name: string; funderId: string | null; fields: unknown[]; createdAt: string }> {
	const db = openDatabase(state);
	const rows = db.prepare("SELECT * FROM application_form_templates ORDER BY createdAt DESC").all() as Array<Record<string, unknown>>;
	return rows.map((row) => ({
		id: String(row.id),
		name: String(row.name),
		funderId: row.funderId ? String(row.funderId) : null,
		fields: JSON.parse(String(row.fields)) as unknown[],
		createdAt: String(row.createdAt),
	}));
}

export function writeFormTemplate(state: SqliteBootstrapState, template: { id: string; name: string; funderId?: string | null; fields?: unknown[]; createdAt: string }): void {
	const db = openDatabase(state);
	db.prepare(
		`INSERT OR REPLACE INTO application_form_templates (id, name, funderId, fields, createdAt)
		 VALUES (@id, @name, @funderId, @fields, @createdAt)`
	).run({
		id: template.id,
		name: template.name,
		funderId: template.funderId ?? null,
		fields: JSON.stringify(template.fields ?? []),
		createdAt: template.createdAt,
	});
	incrementWriteCounterForDb(db);
}

export function deleteFormTemplate(state: SqliteBootstrapState, id: string): void {
	const db = openDatabase(state);
	db.prepare("DELETE FROM application_form_templates WHERE id = ?").run(id);
	incrementWriteCounterForDb(db);
}

// ============ OUTREACH RECORDS (typed V2) ============

export function readOutreachRecords(state: SqliteBootstrapState, grantId?: string): Array<{ id: string; grantId: string; funderId: string | null; contactName: string; contactEmail: string; method: string; notes: string; outcome: string; followUpDate: string; createdAt: string }> {
	const db = openDatabase(state);
	const sql = grantId
		? "SELECT * FROM outreach_records WHERE grantId = ? ORDER BY createdAt DESC"
		: "SELECT * FROM outreach_records ORDER BY createdAt DESC";
	const rows = grantId
		? (db.prepare(sql).all(grantId) as Array<Record<string, unknown>>)
		: (db.prepare(sql).all() as Array<Record<string, unknown>>);
	return rows.map((row) => ({
		id: String(row.id),
		grantId: String(row.grantId),
		funderId: row.funderId ? String(row.funderId) : null,
		contactName: String(row.contactName),
		contactEmail: String(row.contactEmail),
		method: String(row.method),
		notes: String(row.notes),
		outcome: String(row.outcome),
		followUpDate: String(row.followUpDate),
		createdAt: String(row.createdAt),
	}));
}

export function writeOutreachRecord(state: SqliteBootstrapState, record: { id: string; grantId: string; funderId?: string | null; contactName?: string; contactEmail?: string; method?: string; notes?: string; outcome?: string; followUpDate?: string; createdAt: string }): void {
	const db = openDatabase(state);
	db.prepare(
		`INSERT OR REPLACE INTO outreach_records (id, grantId, funderId, contactName, contactEmail, method, notes, outcome, followUpDate, createdAt)
		 VALUES (@id, @grantId, @funderId, @contactName, @contactEmail, @method, @notes, @outcome, @followUpDate, @createdAt)`
	).run({
		id: record.id,
		grantId: record.grantId,
		funderId: record.funderId ?? null,
		contactName: record.contactName ?? '',
		contactEmail: record.contactEmail ?? '',
		method: record.method ?? 'email',
		notes: record.notes ?? '',
		outcome: record.outcome ?? '',
		followUpDate: record.followUpDate ?? '',
		createdAt: record.createdAt,
	});
	incrementWriteCounterForDb(db);
}

export function deleteOutreachRecord(state: SqliteBootstrapState, id: string): void {
	const db = openDatabase(state);
	db.prepare("DELETE FROM outreach_records WHERE id = ?").run(id);
	incrementWriteCounterForDb(db);
}
