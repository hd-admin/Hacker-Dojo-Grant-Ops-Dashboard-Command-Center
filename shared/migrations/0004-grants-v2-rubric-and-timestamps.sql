-- Migration 0004: Add fit-rubric and timestamp columns to grants_v2
-- Adds fields the new transparent fit rubric pipeline needs:
--   * lastSeenAt   - last observation timestamp; bumped on every crawl
--                    regardless of whether fields changed.
--   * lastUpdatedAt- timestamp of last field-level change.
--   * fitRubric    - JSON-encoded full 5-dimension rubric with per-dimension
--                    justifications + overall rationale.
-- isArchived is derived from the existing status column; the UI uses
-- status='archived' as the canonical flag.
ALTER TABLE grants_v2 ADD COLUMN lastSeenAt TEXT DEFAULT NULL;
ALTER TABLE grants_v2 ADD COLUMN lastUpdatedAt TEXT DEFAULT NULL;
ALTER TABLE grants_v2 ADD COLUMN fitRubric TEXT DEFAULT NULL;
