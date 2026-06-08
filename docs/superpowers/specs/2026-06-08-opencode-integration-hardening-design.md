# OpenCode Crawl Integration Hardening — Design

**Date:** 2026-06-08
**Status:** Approved for planning
**Author:** Ken Li (with Claude)

## Problem

The grant-discovery crawl silently does nothing. OpenCode is installed
(`/Users/mistlight/.nvm/.../opencode` v1.16.2) and authenticated (OpenAI, MiniMax,
Kimi), yet no `CrawlRun` has ever completed (`crawl_runs_v2` has 0 rows) and the UI
shows no error.

### Root causes found (with evidence)

1. **Invocation hangs.** The app runs `opencode run --format json "<prompt>"` with
   the default agent, `stdin: 'ignore'`, and **no `--dangerously-skip-permissions`**
   (`opencode-client.ts:546-637, 673`). Reproduced directly: the exact command hangs
   ≥90s with zero output (SIGKILL'd); the same command with a fast model + trivial
   prompt returns valid JSON in 4s. In-app this hits the 60s timeout
   (`settings.timeoutMs || 60000`) → `failureMode: 'timeout'`.

2. **Errors are swallowed.** On a failed/timed-out source, `performResearch` calls
   `logger.warn` and continues the per-source loop (`research-service.ts:209-376`,
   warn at 232-234). The
   `CrawlRun` still finishes as `status: 'completed'`, `grantsMatched: 0`,
   `errorMessage: undefined`. The UI reads that as a clean, empty, successful crawl.

3. **Stale `isConfigured` gate.** `/api/crawl/start` blocks on the DB flag
   `opencode_settings.isConfigured` (currently `false`, `binaryPath: ""`) and returns
   `OPENCODE_NOT_CONFIGURED` (`crawl/start/route.ts:35-40`) — even though the runtime
   adapter's own `isConfigured()` resolves OpenCode from PATH (`opencode-client.ts:777-784`).
   The route trusts the stale boolean instead of real detection.

4. **Tests can't see any of it.** The vitest suite uses `FakeOpencodeProvider`
   (`opencode-client.ts:292`) which always returns mock grants. The real CLI path is
   never exercised, so typecheck ✅ + tests ✅ + real crawl ❌.

Secondary (operational, not integration defects): all `crawl_schedules` have
`nextScheduledAt` in the future, and 13/14 sources have `reviewStatus: undefined`
(not `approved`), so the scheduler skips them and no "Crawl Now" button renders.

## Decisions (locked)

- **Always use OpenCode's configured default model** — never pass `-m`.
- **Always pass `--dangerously-skip-permissions`** on every `run` invocation.
- **Empty result is success.** "OpenCode ran, found 0 grants" → success,
  `grantsMatched: 0`. Only an actual failure/timeout/parse-error is surfaced as a
  failure. Zero matches is NOT an error.

## Design

### 1. Fix the hang centrally
In `runCommand()`, when the subcommand is `run`, inject
`--dangerously-skip-permissions` immediately after `run`. One change covers all 5
call sites (research, draft, peer-discovery, funder-insights, extract) and any
future ones. Keep `stdin: 'ignore'` and the default model.

### 2. Make crawl outcomes honest
`performResearch` accumulates per-source outcomes (`succeeded | failed`, with the
`failureMode`/error for failures). Final `CrawlRun.status`:
- **all sources failed** → `failed`, `errorMessage` = summary (mode + count).
- **some failed** → `partial-results`, `errorMessage` = which sources + mode.
- **all succeeded** (any number of grants, including 0) → `completed`.

Because `/api/crawl/start` already throws when `crawlRun.status === 'failed'`
(`crawl/start/route.ts:50-52`), a fully-failed crawl now surfaces as a real error in
the jobs feed instead of a clean empty run. `partial-results` is shown as a warning
state, not silent.

A distinct failure mode applies when OpenCode succeeds (exit 0) but its output can't
be parsed into the research schema (`research-service.ts:415-423`,
`ResearchResponseSchema`): that source is counted as `failed` with a
`parse-error` reason, not silently dropped.

### 3. Trust real detection, not the stale flag
Replace the `/api/crawl/start` gate so "configured" means **the adapter can actually
run** — `binaryPath` set OR OpenCode resolved on PATH (reuse the existing
`resolveOpencodePath` / cached-path logic). When PATH detection succeeds, persist
`isConfigured: true` (and the resolved `binaryPath`) so the UI and other gates agree.
The scheduled path (`runResearch`) already builds the adapter and does not hard-gate
on the flag; it inherits the same detection.

### 4. Health/diagnostics probe the binary
`crawlerStatus` (shown in Settings, `SettingsView.tsx:689`) and the diagnostics route
run a fast real probe (`opencode --version` + cached PATH/auth resolution) so the UI
goes **red** when OpenCode is missing or unauthenticated, instead of looking healthy
while crawls quietly no-op.

### 5. Real smoke test (regression guard)
Add `npm run smoke:opencode` mirroring `smoke:propublica`: run one real
`opencode run --dangerously-skip-permissions --format json "<tiny prompt>"` with a
generous timeout and assert it exits 0 and emits parseable JSON event stream that
`normalizeOpencodeOutput` can reduce to text. This is the only test that exercises the
real CLI; it is opt-in (not in the default `npm test`) so CI without OpenCode is
unaffected, but it exists to catch invocation regressions.

## Error handling summary

| Situation | Result |
|---|---|
| OpenCode not on PATH and no `binaryPath` | `/api/crawl/start` → `OPENCODE_NOT_CONFIGURED` (clear), health red |
| `run` hangs | killed at `timeoutMs` → source `failed` (`timeout`) → run `failed`/`partial-results` |
| OpenCode exits non-zero | source `failed` (classified mode) → run reflects it |
| Exit 0, unparseable output | source `failed` (`parse-error`) → run reflects it |
| Exit 0, valid JSON, 0 grants | source `succeeded`, `grantsMatched: 0`, run `completed` |
| Exit 0, valid JSON, N grants | source `succeeded`, grants ingested, run `completed` |

## Testing

- Unit (existing fake provider): assert the new status logic — all-fail → `failed`,
  mixed → `partial-results`, all-success-zero-grants → `completed`.
- Unit: `runCommand` includes `--dangerously-skip-permissions` for `run`.
- Unit: configured-gate accepts PATH-resolved binary.
- `smoke:opencode`: real end-to-end CLI invocation returns parseable JSON.

## End-to-end validation (after implementation)

1. Configure: detection sets `isConfigured: true` + resolved `binaryPath`.
2. Approve all 14 sources (`reviewStatus: 'approved'`).
3. Trigger a crawl (manual `/api/crawl/start` and/or a due schedule).
4. Confirm a real `CrawlRun` row with `status` ∈ {completed, partial-results, failed}
   and, on success, `grantsMatched` ≥ 0 with grants persisted — or a **loud** error
   surfaced in the jobs feed / health on failure.

## Out of scope

- Reworking the scheduler's timing or the approval workflow itself (operational data,
  not integration defects). We will approve sources as a validation step, not redesign
  the gate.
- Changing OpenCode model/provider configuration (use whatever default is configured).
