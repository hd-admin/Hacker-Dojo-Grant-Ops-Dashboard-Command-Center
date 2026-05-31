-- Migration 0001: Initial V2 Typed Schema
-- Creates all v2 typed tables, FTS5, triggers, and indexes
-- Applied by the migration framework on first run

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

-- 2.22 Schema Migrations (tracking table)
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
