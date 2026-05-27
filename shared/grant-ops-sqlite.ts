import { mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { PersistedData } from "./grant-ops-persistence";
import {
	defaultOpencodeSettings,
	defaultProfile,
	normalizeGrantDetailFields,
} from "./seed-data";
import type {
	ApprovalRecord,
	AuditEvent,
	ConflictRecord,
	CrawlRun,
	CrawlSchedule,
	DocumentMetadata,
	DraftArtifact,
	DuplicateCandidate,
	FollowUp,
	Grant,
	JobFailureCategory,
	JobQueueItem,
	Notification,
	OpencodeSettings,
	OrganizationProfile,
	RevisionRequest,
	Source,
	SubmissionManifest,
	SubmissionRecord,
	Task,
	BackupFreshnessStatus,
	BackupVerificationRecord,
} from "./types";

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

function openDatabase(state: SqliteBootstrapState): SqliteDatabase {
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
	const db = new Database(state.dbPath);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");
	ensureSchema(db);
	dbCache.set(state.dataDir, db);
	return db;
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
		return;
	}
	db.prepare(`INSERT OR REPLACE INTO ${table} (id, json) VALUES (?, ?)`).run(
		id,
		JSON.stringify(row),
	);
}

function saveMeta(db: SqliteDatabase, key: string, value: string): void {
	db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(
		key,
		value,
	);
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
	replaceTable<Source>(db, "sources", []);
	replaceTable<CrawlRun>(db, "crawl_runs", []);
	replaceTable<DraftArtifact>(db, "draft_artifacts", []);
	replaceTable<RevisionRequest>(db, "revision_requests", []);
	replaceTable<ApprovalRecord>(db, "approval_records", []);
	replaceTable<SubmissionRecord>(db, "submission_records", []);
	replaceTable<FollowUp>(db, "follow_ups", []);
	replaceTable<DocumentMetadata>(db, "documents", []);
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
}

export function runMigrations(state: SqliteBootstrapState): {
	success: boolean;
	version: number;
	message?: string;
} {
	try {
		const currentVersion = getCurrentSchemaVersion(state);
		if (currentVersion < CURRENT_SCHEMA_VERSION) {
			setSchemaVersion(state, CURRENT_SCHEMA_VERSION);
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
}

export function deleteCrawlSchedule(state: SqliteBootstrapState, id: string): void {
	const db = openDatabase(state);
	const schedules = readCrawlSchedules(state).filter((schedule) => schedule.id !== id);
	replaceTable<CrawlSchedule>(db, 'crawl_schedules', schedules);
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
