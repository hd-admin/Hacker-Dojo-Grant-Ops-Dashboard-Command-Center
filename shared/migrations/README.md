# Schema Migrations

This directory contains forward-only SQLite migration scripts for the Hacker Dojo Grant Ops database.

## Naming convention

Migration files MUST follow this pattern:

```
NNNN-description.sql
```

Where `NNNN` is a zero-padded 4-digit sequence number (e.g., `0001`, `0002`).

## Execution

- Migrations are applied in numeric order by the migration framework in `shared/grant-ops-sqlite.ts`.
- Each migration runs inside a transaction.
- An automatic SQLite backup is created before each migration.
- On first run, `schema_version` is set to 1 for the initial schema.
- If any migration fails, startup is aborted.

## Rules

1. **Forward-only** — Migrations never roll back. To fix a bad migration, create a new one.
2. **Idempotent where possible** — Use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN` etc.
3. **No destructive changes** — Never `DROP TABLE` or `DROP COLUMN` without explicit justification.
4. **Test first** — Test schema changes against a copy of the production database before merging.
