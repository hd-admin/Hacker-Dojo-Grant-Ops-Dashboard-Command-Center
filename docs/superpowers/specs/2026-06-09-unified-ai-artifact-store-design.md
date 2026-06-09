# Unified AI Artifact Store — Design

**Date:** 2026-06-09
**Status:** Approved (design)

## Problem

AI/LLM-generated artifacts are currently stored three incompatible ways, and the
machinery meant to manage them is dead code:

| Artifact | Storage today | Validated? |
|---|---|---|
| Crawl/grant results | SQLite `grants` (JSON blob) **+** best-effort mirror to `grants_v2` (typed) — can desync | ✅ Zod |
| Fit rubrics | JSON blob embedded in `grants` | ✅ Zod |
| Draft proposals | SQLite `draft_artifacts` (typed) | ⚠️ partial |
| Peer discovery / Funder insights / Eligibility vetting | Loose JSON files on the filesystem under `~/.grant-ops-data/artifacts/**` | ✅ Zod |

- `cache-cleanup.ts` defines retention rules (24h/7d/30d) and `_startPeriodicCleanup()`,
  but nothing ever calls it.
- `crawl-scheduler-service.ts` uses `setInterval` but is never auto-started.
- The app is serverless-style Next.js with no `instrumentation.ts` / startup hook.
- `mirrorGrantToV2()` is best-effort: if it fails, FTS5 search silently goes stale.

## Goals

1. One managed system of record for **all** AI-generated artifacts.
2. Every artifact's JSON is **schema-verified** on the way in, then stored in the DB.
3. Stored artifacts are **processed in the backend** into queryable projections.
4. **Automatic cleanup** runs on a regular interval.

## Decisions (locked)

- **Store model:** Source-of-truth + projections. A single `ai_artifacts` table holds
  every verified JSON payload as the system of record. A backend processor projects
  each into the existing typed/queryable tables (`grants_v2`, `draft_artifacts`, and new
  small projection tables for the discovery types). Typed tables become derived caches.
- **Execution:** In-process timers started from a new Next.js `instrumentation.ts`.
- **Retention:** Prune processed raw artifacts after a grace window; keep projections forever.

## Architecture

### 1. `ai_artifacts` table (new, system of record)

```sql
CREATE TABLE ai_artifacts (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,                 -- 'research' | 'peer-discovery' | 'funder-insights'
                                               --  | 'eligibility-vetting' | 'draft' | 'fit-rubric'
  schemaVersion INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending','verified','processed','failed','rejected')),
  payload       TEXT NOT NULL,                 -- the validated JSON, verbatim
  jobId         TEXT,                          -- ties back to job_queue / crawl_runs
  sourceId      TEXT,                          -- optional link (source/grant/funder)
  error         TEXT DEFAULT '',
  attempts      INTEGER NOT NULL DEFAULT 0,
  createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
  verifiedAt    TEXT DEFAULT '',
  processedAt   TEXT DEFAULT '',               -- basis for retention
  deletedAt     TEXT DEFAULT NULL
);
CREATE INDEX idx_ai_artifacts_status      ON ai_artifacts(status);
CREATE INDEX idx_ai_artifacts_type_status ON ai_artifacts(type, status);
CREATE INDEX idx_ai_artifacts_processedAt ON ai_artifacts(processedAt);
```

### 2. Lifecycle (state machine)

```
write → [Zod validate]
          ├─ pass → status=verified ──► [processor] ──► status=processed (projection written)
          │                                  └─ projection error → status=failed (retry up to N)
          └─ fail → status=rejected (error recorded, never projected)
```

### 3. Schema registry

A single `type → ZodSchema` map, reusing existing schemas in `artifact-schemas.ts`
(`ResearchResponseSchema`, `PeerDiscoveryArtifactSchema`, `FunderInsightArtifactSchema`,
`EligibilityVettingArtifactSchema`, draft schema). Only place that knows how to verify a type.

### 4. Store chokepoint

`artifact-store.ts` exposes `storeArtifact(type, rawJson, meta)`:
pick schema by `type` → `safeParse` → insert row as `verified` (on pass) or `rejected`
(on fail, with `error`). No caller writes a projection directly anymore.

### 5. Backend processor (projection)

`projectArtifact(row)` dispatcher, idempotent upserts keyed by artifact `id`:
- `research` → upsert `grants_v2` (+ `crawl_runs_v2`), replacing today's best-effort `mirrorGrantToV2`.
- `draft` → `draft_artifacts`.
- `peer-discovery` / `funder-insights` / `eligibility-vetting` → new small typed projection
  tables, replacing the loose filesystem files.

On success → `processed`, set `processedAt`. On error → `failed`, `attempts++`.

### 6. Cleanup (retention)

`cleanupArtifacts()`:
- `processed` with `processedAt` older than **30d** → delete raw row (projection untouched).
- `rejected`/`failed` older than **7d** → delete.
- Folds in the existing `cache-cleanup.ts` filesystem sweep (tmp/logs/cache) for one entry point.

### 7. Execution wiring — `frontend/instrumentation.ts`

`register()` (guarded to run once, server runtime only) starts:
- processor loop — drains `verified` artifacts every ~30s,
- cleanup loop — runs `cleanupArtifacts()` every ~6h,
- the existing dormant `startCrawlScheduler()`.

### 8. Migration

- Migration `0005-ai-artifacts.sql`: table + indexes (+ new discovery projection tables).
- One-time backfill: import existing `~/.grant-ops-data/artifacts/**` files into
  `ai_artifacts` as `processed`, so nothing is orphaned.

## Testing (TDD)

- store validates and rejects bad payloads (`rejected`, error recorded)
- processor is idempotent (re-running projects once)
- failed-artifact retry increments `attempts`, stops at cap
- retention deletes raw `processed` rows past grace but leaves projection rows intact
- retention deletes `failed`/`rejected` past 7d
- instrumentation guard starts loops exactly once
- existing research/discovery flows repointed at the store still pass

## Net effect

One table is the source of truth; every artifact is Zod-verified on the way in;
projections are reliable and idempotent (no silent mirror desync); cleanup actually runs.
