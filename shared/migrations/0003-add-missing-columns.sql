-- Migration 0003: Add missing columns per product spec v2
-- Adds columns that were defined in 12-data-architecture.md but missing from initial schema
-- Note: SQLite ALTER TABLE ADD COLUMN does not support CHECK constraints; those are enforced at the application level

-- documents_v2: add originalName, classification, tags, deletedAt
ALTER TABLE documents_v2 ADD COLUMN originalName TEXT DEFAULT '';
ALTER TABLE documents_v2 ADD COLUMN classification TEXT DEFAULT 'draft-only';
ALTER TABLE documents_v2 ADD COLUMN tags TEXT DEFAULT '[]';
ALTER TABLE documents_v2 ADD COLUMN deletedAt TEXT DEFAULT NULL;

-- draft_versions: add jobId, sections, wordCount, groundingDocumentIds, groundingSourceUrls, notes, status, qualityWarning, approvedAt, approvedBy
ALTER TABLE draft_versions ADD COLUMN jobId TEXT DEFAULT '';
ALTER TABLE draft_versions ADD COLUMN sections TEXT DEFAULT '[]';
ALTER TABLE draft_versions ADD COLUMN wordCount INTEGER DEFAULT 0;
ALTER TABLE draft_versions ADD COLUMN groundingDocumentIds TEXT DEFAULT '[]';
ALTER TABLE draft_versions ADD COLUMN groundingSourceUrls TEXT DEFAULT '[]';
ALTER TABLE draft_versions ADD COLUMN notes TEXT DEFAULT '';
ALTER TABLE draft_versions ADD COLUMN status TEXT DEFAULT 'draft';
ALTER TABLE draft_versions ADD COLUMN qualityWarning INTEGER DEFAULT 0;
ALTER TABLE draft_versions ADD COLUMN approvedAt TEXT DEFAULT '';
ALTER TABLE draft_versions ADD COLUMN approvedBy TEXT DEFAULT '';

-- tasks_v2: add blockSubmission, notes, updatedAt
ALTER TABLE tasks_v2 ADD COLUMN blockSubmission INTEGER DEFAULT 0;
ALTER TABLE tasks_v2 ADD COLUMN notes TEXT DEFAULT '';
ALTER TABLE tasks_v2 ADD COLUMN updatedAt TEXT NOT NULL DEFAULT (datetime('now'));

-- crawl_runs_v2: add jobId, pagesCrawled, pagesFailed, artifactPath
ALTER TABLE crawl_runs_v2 ADD COLUMN jobId TEXT DEFAULT NULL;
ALTER TABLE crawl_runs_v2 ADD COLUMN pagesCrawled INTEGER DEFAULT 0;
ALTER TABLE crawl_runs_v2 ADD COLUMN pagesFailed INTEGER DEFAULT 0;
ALTER TABLE crawl_runs_v2 ADD COLUMN artifactPath TEXT DEFAULT '';

-- agent_jobs: add sourceId, params
ALTER TABLE agent_jobs ADD COLUMN sourceId TEXT DEFAULT NULL;
ALTER TABLE agent_jobs ADD COLUMN params TEXT DEFAULT '{}';

-- sources_v2: add consecutiveFailures
ALTER TABLE sources_v2 ADD COLUMN consecutiveFailures INTEGER DEFAULT 0;
