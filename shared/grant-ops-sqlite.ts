import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultOpencodeSettings, defaultProfile, normalizeGrantDetailFields, seedGrants, seedNotifications, seedTasks } from './seed-data';
import type {
  ApprovalRecord,
  CrawlRun,
  DraftArtifact,
  DocumentMetadata,
  FollowUp,
  Grant,
  Notification,
  OpencodeSettings,
  OrganizationProfile,
  RevisionRequest,
  Source,
  SubmissionRecord,
  Task,
} from './types';
import type { PersistedData } from './grant-ops-persistence';

export interface SqliteBootstrapState {
  dataDir: string;
  dbPath: string;
  documentsDir: string;
}

type SqliteDatabase = InstanceType<typeof Database>;

const dbCache = new Map<string, SqliteDatabase>();
const initialized = new Set<string>();

export function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }

  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.grant-ops-data');
}

export function getSqliteState(dataDir = resolveDataDir()): SqliteBootstrapState {
  return {
    dataDir,
    dbPath: path.join(dataDir, 'grant-ops.sqlite'),
    documentsDir: path.join(dataDir, 'documents'),
  };
}

function openDatabase(state: SqliteBootstrapState): SqliteDatabase {
  const existing = dbCache.get(state.dataDir);
  if (existing) {
    return existing;
  }

  const db = new Database(state.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
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
  `);
}

function readJsonFile<T>(filePath: string): Promise<T | null> {
  return fs.readFile(filePath, 'utf8').then((raw) => JSON.parse(raw) as T).catch(() => null);
}

async function readLegacyBootstrap(state: SqliteBootstrapState): Promise<{
  grants?: Grant[];
  profile?: OrganizationProfile;
  persisted?: PersistedData | null;
  standaloneOpencode?: OpencodeSettings | null;
}> {
  const grants = await readJsonFile<Grant[]>(path.join(state.dataDir, 'grants.json'));
  const profile = await readJsonFile<OrganizationProfile>(path.join(state.dataDir, 'profile.json'));
  const persisted = await readJsonFile<PersistedData>(path.join(state.dataDir, 'persisted-data.json'));
  const standaloneOpencode = await readJsonFile<OpencodeSettings>(path.join(state.dataDir, 'opencode-settings.json'));
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
    'grants', 'sources', 'crawl_runs', 'draft_artifacts', 'revision_requests',
    'approval_records', 'submission_records', 'follow_ups', 'notifications',
    'tasks', 'documents', 'profile', 'opencode_settings',
  ];
  return tables.some((table) => db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get() !== undefined);
}

function replaceTable<T extends { id: string }>(db: SqliteDatabase, table: string, rows: T[]): void {
  const deleteStmt = db.prepare(`DELETE FROM ${table}`);
  const insertStmt = db.prepare(`INSERT INTO ${table} (id, json) VALUES (@id, @json)`);
  const tx = db.transaction((items: T[]) => {
    deleteStmt.run();
    const uniqueItems = Array.from(new Map(items.map((item) => [item.id, item])).values());
    for (const item of uniqueItems) {
      insertStmt.run({ id: item.id, json: JSON.stringify(item) });
    }
  });
  tx(rows);
}

function loadTable<T>(db: SqliteDatabase, table: string): T[] {
  const rows = db.prepare(`SELECT json FROM ${table} ORDER BY rowid ASC`).all() as Array<{ json: string }>;
  return rows.map((row) => JSON.parse(row.json) as T);
}

function loadSingleton<T>(db: SqliteDatabase, table: string, id: string): T | null {
  const row = db.prepare(`SELECT json FROM ${table} WHERE id = ? LIMIT 1`).get(id) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as T) : null;
}

function saveSingleton<T>(db: SqliteDatabase, table: string, id: string, row: T | null): void {
  const deleteStmt = db.prepare(`DELETE FROM ${table}`);
  if (!row) {
    deleteStmt.run();
    return;
  }
  db.prepare(`INSERT OR REPLACE INTO ${table} (id, json) VALUES (?, ?)`).run(id, JSON.stringify(row));
}

function saveMeta(db: SqliteDatabase, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
}

function loadMeta(db: SqliteDatabase, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ? LIMIT 1').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function seedDefaultState(db: SqliteDatabase): void {
  replaceTable<Grant>(db, 'grants', seedGrants.map((grant) => normalizeGrantDetailFields(grant)));
  saveSingleton<OrganizationProfile>(db, 'profile', 'profile', defaultProfile);
  replaceTable<Notification>(db, 'notifications', [...seedNotifications]);
  replaceTable<Task>(db, 'tasks', [...seedTasks]);
  replaceTable<Source>(db, 'sources', []);
  replaceTable<CrawlRun>(db, 'crawl_runs', []);
  replaceTable<DraftArtifact>(db, 'draft_artifacts', []);
  replaceTable<RevisionRequest>(db, 'revision_requests', []);
  replaceTable<ApprovalRecord>(db, 'approval_records', []);
  replaceTable<SubmissionRecord>(db, 'submission_records', []);
  replaceTable<FollowUp>(db, 'follow_ups', []);
  replaceTable<DocumentMetadata>(db, 'documents', []);
  saveSingleton<OpencodeSettings>(db, 'opencode_settings', 'opencode_settings', defaultOpencodeSettings);
  saveMeta(db, 'lastSync', new Date().toISOString());
}

function bootstrapFromLegacy(db: SqliteDatabase, legacy: Awaited<ReturnType<typeof readLegacyBootstrap>>): void {
  if (legacy.grants) {
    replaceTable<Grant>(db, 'grants', legacy.grants.map((grant) => normalizeGrantDetailFields(grant)));
  }

  if (legacy.profile) {
    saveSingleton<OrganizationProfile>(db, 'profile', 'profile', legacy.profile);
  } else {
    saveSingleton<OrganizationProfile>(db, 'profile', 'profile', defaultProfile);
  }

  replaceTable<Source>(db, 'sources', legacy.persisted?.sources ?? []);
  replaceTable<CrawlRun>(db, 'crawl_runs', legacy.persisted?.crawlRuns ?? []);
  replaceTable<DraftArtifact>(db, 'draft_artifacts', legacy.persisted?.draftArtifacts ?? []);
  replaceTable<RevisionRequest>(db, 'revision_requests', legacy.persisted?.revisionRequests ?? []);
  replaceTable<ApprovalRecord>(db, 'approval_records', legacy.persisted?.approvalRecords ?? []);
  replaceTable<SubmissionRecord>(db, 'submission_records', legacy.persisted?.submissionRecords ?? []);
  replaceTable<FollowUp>(db, 'follow_ups', legacy.persisted?.followUps ?? []);
  replaceTable<Notification>(db, 'notifications', legacy.persisted?.notifications ?? []);
  replaceTable<Task>(db, 'tasks', legacy.persisted?.tasks ?? []);
  replaceTable<DocumentMetadata>(db, 'documents', legacy.persisted?.documents ?? []);

  const opencodeSettings = legacy.standaloneOpencode ?? legacy.persisted?.opencodeSettings ?? defaultOpencodeSettings;
  saveSingleton<OpencodeSettings>(db, 'opencode_settings', 'opencode_settings', opencodeSettings);
  saveMeta(db, 'lastSync', legacy.persisted?.lastSync ?? new Date().toISOString());
}

function ensureBootstrapped(state: SqliteBootstrapState): SqliteDatabase {
  const db = openDatabase(state);
  ensureSchema(db);

  if (initialized.has(state.dataDir)) {
    return db;
  }

  if (hasAnyRows(db)) {
    initialized.add(state.dataDir);
    return db;
  }

  return db;
}

export async function getBootstrappedDatabase(state: SqliteBootstrapState): Promise<SqliteDatabase> {
  const db = ensureBootstrapped(state);
  if (initialized.has(state.dataDir)) {
    return db;
  }

  const legacy = await readLegacyBootstrap(state);
  const hasLegacy = Boolean(
    legacy.grants || legacy.profile || legacy.persisted || legacy.standaloneOpencode,
  );

  if (hasLegacy) {
    bootstrapFromLegacy(db, legacy);
  } else {
    seedDefaultState(db);
  }

  initialized.add(state.dataDir);
  return db;
}

export async function readPersistedData(state: SqliteBootstrapState): Promise<PersistedData> {
  const db = await getBootstrappedDatabase(state);
  return {
    sources: loadTable<Source>(db, 'sources'),
    crawlRuns: loadTable<CrawlRun>(db, 'crawl_runs'),
    draftArtifacts: loadTable<DraftArtifact>(db, 'draft_artifacts'),
    revisionRequests: loadTable<RevisionRequest>(db, 'revision_requests'),
    approvalRecords: loadTable<ApprovalRecord>(db, 'approval_records'),
    submissionRecords: loadTable<SubmissionRecord>(db, 'submission_records'),
    followUps: loadTable<FollowUp>(db, 'follow_ups'),
    opencodeSettings: loadSingleton<OpencodeSettings>(db, 'opencode_settings', 'opencode_settings'),
    notifications: loadTable<Notification>(db, 'notifications'),
    tasks: loadTable<Task>(db, 'tasks'),
    documents: loadTable<DocumentMetadata>(db, 'documents'),
    lastSync: loadMeta(db, 'lastSync') ?? new Date().toISOString(),
  };
}

export async function writePersistedData(state: SqliteBootstrapState, data: PersistedData): Promise<void> {
  const db = await getBootstrappedDatabase(state);
  replaceTable<Source>(db, 'sources', data.sources);
  replaceTable<CrawlRun>(db, 'crawl_runs', data.crawlRuns);
  replaceTable<DraftArtifact>(db, 'draft_artifacts', data.draftArtifacts);
  replaceTable<RevisionRequest>(db, 'revision_requests', data.revisionRequests);
  replaceTable<ApprovalRecord>(db, 'approval_records', data.approvalRecords);
  replaceTable<SubmissionRecord>(db, 'submission_records', data.submissionRecords);
  replaceTable<FollowUp>(db, 'follow_ups', data.followUps);
  replaceTable<Notification>(db, 'notifications', data.notifications);
  replaceTable<Task>(db, 'tasks', data.tasks);
  replaceTable<DocumentMetadata>(db, 'documents', data.documents);
  saveSingleton<OpencodeSettings>(db, 'opencode_settings', 'opencode_settings', data.opencodeSettings);
  saveMeta(db, 'lastSync', data.lastSync);
}

export async function readGrants(state: SqliteBootstrapState): Promise<Grant[]> {
  const db = await getBootstrappedDatabase(state);
  return loadTable<Grant>(db, 'grants').map((grant) => normalizeGrantDetailFields(grant));
}

export async function writeGrants(state: SqliteBootstrapState, grants: Grant[]): Promise<void> {
  const db = await getBootstrappedDatabase(state);
  replaceTable<Grant>(db, 'grants', grants.map((grant) => normalizeGrantDetailFields(grant)));
}

export async function readProfile(state: SqliteBootstrapState): Promise<OrganizationProfile> {
  const db = await getBootstrappedDatabase(state);
  return loadSingleton<OrganizationProfile>(db, 'profile', 'profile') ?? { ...defaultProfile };
}

export async function writeProfile(state: SqliteBootstrapState, profile: OrganizationProfile): Promise<void> {
  const db = await getBootstrappedDatabase(state);
  saveSingleton<OrganizationProfile>(db, 'profile', 'profile', profile);
}

export async function readOpencodeSettings(state: SqliteBootstrapState): Promise<OpencodeSettings | null> {
  const db = await getBootstrappedDatabase(state);
  return loadSingleton<OpencodeSettings>(db, 'opencode_settings', 'opencode_settings');
}

export async function writeOpencodeSettings(state: SqliteBootstrapState, settings: OpencodeSettings): Promise<void> {
  const db = await getBootstrappedDatabase(state);
  saveSingleton<OpencodeSettings>(db, 'opencode_settings', 'opencode_settings', settings);
}

export async function clearDatabase(state: SqliteBootstrapState): Promise<void> {
  resetSqliteCache(state.dataDir);
  await fs.rm(state.dbPath, { force: true });
  await fs.rm(state.documentsDir, { recursive: true, force: true });
}
