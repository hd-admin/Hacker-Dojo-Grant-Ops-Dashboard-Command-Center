# 09 — Technical Architecture: OpenCode Agent Loop & Async Operations

> **Status**: Critical — must be implemented correctly for the app to work.

## The Problem

The current app spawns OpenCode with a prompt and waits. This is broken in several ways:

1. **No structured output contract** — OpenCode returns free-form text; we guess if it worked
2. **No retry on malformed output** — if the JSON is broken, the operation fails silently
3. **UI freezes** — the user presses a button and sees nothing until the agent finishes (or times out)
4. **No progress visibility** — user can't tell if the agent is thinking, stuck, or done
5. **No artifact verification** — we don't typecheck what the agent returns

## The Solution: Typed Artifact Agent Loop

### Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    GRANT OPS APP                          │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │   UI     │    │  Agent Loop  │    │  OpenCode CLI │  │
│  │ (React)  │◄──►│  Controller  │◄──►│  (subprocess) │  │
│  │          │    │              │    │               │  │
│  │ progress │    │ verify/retry │    │ writes to     │  │
│  │ bars     │    │ typecheck    │    │ tmp/ dir      │  │
│  │ status   │    │ parse JSON   │    │               │  │
│  └──────────┘    └──────────────┘    └───────────────┘  │
│                         │                                │
│                         ▼                                │
│               ┌──────────────────┐                      │
│               │  tmp/ artifacts  │                      │
│               │  (JSON files)    │                      │
│               └──────────────────┘                      │
└──────────────────────────────────────────────────────────┘
```

### Key Principle: Agents Write Artifacts, App Reads Artifacts

OpenCode agents never communicate results via stdout. Instead, they write structured JSON files to a well-known `tmp/` directory. The app reads, typechecks, and ingests these artifacts.

## Artifact Specification

### Directory Structure

```
.grant-ops-data/
  tmp/                          # Agent working directory
    research-{jobId}.json       # Research results
    draft-{jobId}-{version}.json # Draft artifacts
    crawl-{jobId}.json          # Crawl results
    match-{jobId}.json          # Match scoring results
    extract-{jobId}.json        # Award letter extraction
    session-{jobId}.log         # Agent session logs
    .cache/                     # Agent cache (periodically cleaned)
  artifacts/                    # Persisted verified artifacts
    research/
    crawls/
    drafts/
    matches/
    extracts/
```

### Artifact Schemas (What We Tell OpenCode to Write)

#### 1. Research Result Artifact

```typescript
// tmp/research-{jobId}.json
interface ResearchArtifact {
  artifactType: "research";
  jobId: string;
  timestamp: string;
  grants: Array<{
    title: string;
    funder: string;
    funderShort: string;
    award?: string;
    awardSort?: number;
    deadline?: string;
    deadlineConfidence?: "exact" | "estimated" | "rolling" | "unknown";
    eligibility?: string;
    requirements?: string[];
    externalUrl?: string;
    summary?: string;
    tags: string[];
    category?: string;
  }>;
  evidence: Array<{
    grantTitle: string;
    evidenceType: "fit_score" | "deadline" | "award_amount" | "eligibility" | "requirements" | "giving_pattern";
    content: string;
    sourceUrl?: string;
  }>;
  rationale?: string;
  sourcesFound: number;
  grantsFound: number;
  errors?: string[];
}
```

#### 2. Draft Artifact

```typescript
// tmp/draft-{jobId}-{version}.json
interface DraftArtifact {
  artifactType: "draft";
  jobId: string;
  grantId: string;
  version: number;
  timestamp: string;
  content: string;  // Full draft text
  sections: Array<{
    sectionTitle: string;
    content: string;
    groundingSources: string[];  // document IDs or URLs
    isGrounded: boolean;
  }>;
  wordCount: number;
  groundingDocumentIds: string[];
  groundingSourceUrls: string[];
  notes?: string;
  errors?: string[];
}
```

#### 3. Crawl Result Artifact

```typescript
// tmp/crawl-{jobId}.json
interface CrawlArtifact {
  artifactType: "crawl";
  jobId: string;
  sourceId: string;
  timestamp: string;
  status: "completed" | "partial" | "failed";
  grantsFound: Array<{
    title: string;
    funder: string;
    award?: string;
    deadline?: string;
    url?: string;
    rawText?: string;
  }>;
  errorMessage?: string;
  pagesCrawled: number;
  pagesFailed: number;
}
```

#### 4. Match Score Artifact

```typescript
// tmp/match-{jobId}.json
interface MatchArtifact {
  artifactType: "match";
  jobId: string;
  timestamp: string;
  matches: Array<{
    grantTitle: string;
    grantId: string;
    fitScore: number;
    breakdown: {
      missionAlignment: number;
      geographicFocus: number;
      programTrackrecord: number;
      budgetCapacity: number;
      partnershipReadiness: number;
    };
    rationale: string;
  }>;
  totalGrantsEvaluated: number;
  grantsAboveThreshold: number;
}
```

#### 5. Award Extraction Artifact

```typescript
// tmp/extract-{jobId}.json
interface ExtractArtifact {
  artifactType: "extract";
  jobId: string;
  grantId: string;
  timestamp: string;
  extracted: {
    amount?: string;
    startDate?: string;
    endDate?: string;
    reportingDeadlines?: string[];
    complianceRequirements?: string[];
    budgetCategories?: Array<{ category: string; amount: string }>;
    restrictions?: string[];
    contacts?: Array<{ name: string; role: string; email?: string }>;
  };
  confidence: "high" | "medium" | "low";
  sourceDocumentRef: string;
  errors?: string[];
}
```

## The Agent Loop Controller

### Pseudocode

```typescript
// server/agent-loop.ts

type AgentTaskType = "research" | "draft" | "crawl" | "match" | "extract";

interface AgentJob {
  id: string;
  type: AgentTaskType;
  grantId?: string;
  params: Record<string, unknown>;
  status: "queued" | "running" | "verifying" | "retrying" | "completed" | "failed" | "cancelled";
  retryCount: number;
  maxRetries: number;
  artifactPath?: string;
  errorMessage?: string;
  progress: number; // 0-100
  progressStage: string;
}

async function executeAgentJob(job: AgentJob): Promise<void> {
  const tmpDir = path.join(DATA_DIR, "tmp");
  const artifactPath = job.type === 'draft'
    ? path.join(tmpDir, `${job.type}-${job.id}-${job.params.version}.json`)
    : path.join(tmpDir, `${job.type}-${job.id}.json`);

  // 1. Build the prompt with artifact schema embedded
  const prompt = buildPrompt(job.type, job.params, artifactPath);

  // 2. Spawn OpenCode subprocess
  updateJobStatus(job, "running", 0, "Starting agent...");

  let attempt = 0;
  const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        // Ensure no stale artifact from a previous attempt can be reused.
        if (fs.existsSync(artifactPath)) {
          fs.unlinkSync(artifactPath);
        }
        const attemptStartedAt = Date.now();

        // Run OpenCode with timeout
        const result = await runOpenCode(prompt, {
        timeoutMs: job.type === "draft" ? 300000 : 120000,
        workingDir: tmpDir,
        env: { ...process.env, ARTIFACT_PATH: artifactPath },
      });

      // 3. Check if artifact file exists
      if (!fs.existsSync(artifactPath)) {
        if (attempt < maxAttempts) {
          updateJobStatus(job, "retrying", 30, `Artifact not found, retrying (${attempt}/${maxAttempts})...`);
          prompt += `\n\nPREVIOUS ATTEMPT FAILED: No artifact file was written to ${artifactPath}. You MUST write valid JSON to this exact path.`;
          continue;
        }
        throw new Error("Agent did not produce an artifact file after all attempts");
      }

      // 4. Read and parse the artifact
      updateJobStatus(job, "verifying", 80, "Verifying artifact...");
      const stat = fs.statSync(artifactPath);
      if (stat.mtimeMs < attemptStartedAt) {
        throw new Error("Artifact file is stale from an earlier attempt");
      }

      const raw = fs.readFileSync(artifactPath, "utf-8");
      let artifact: unknown;

      try {
        artifact = JSON.parse(raw);
      } catch {
        if (attempt < maxAttempts) {
          updateJobStatus(job, "retrying", 40, `Invalid JSON, retrying (${attempt}/${maxAttempts})...`);
          prompt += `\n\nPREVIOUS ATTEMPT FAILED: The file at ${artifactPath} contained invalid JSON. Ensure valid JSON output.`;
          continue;
        }
        throw new Error("Agent produced invalid JSON after all attempts");
      }

      // 5. Typecheck against schema
      const schema = getSchemaForType(job.type);
      const parseResult = schema.safeParse(artifact);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
        if (attempt < maxAttempts) {
          updateJobStatus(job, "retrying", 50, `Schema mismatch, retrying (${attempt}/${maxAttempts})...`);
          prompt += `\n\nPREVIOUS ATTEMPT FAILED: Schema validation errors: ${errors}. Fix these issues.`;
          continue;
        }
        throw new Error(`Schema validation failed after all attempts: ${errors}`);
      }

      // 6. Persist verified artifact
      const verified = parseResult.data;
      const artifactDirByType = {
        research: 'research',
        crawl: 'crawls',
        draft: 'drafts',
        match: 'matches',
        extract: 'extracts',
      } as const;

      const persistPath = path.join(
        DATA_DIR,
        'artifacts',
        artifactDirByType[job.type],
        `${job.id}.json`
      );
      fs.mkdirSync(path.dirname(persistPath), { recursive: true });
      fs.writeFileSync(persistPath, JSON.stringify(verified, null, 2));

      // 7. Ingest into database
      await ingestArtifact(job.type, verified, job);

      // 8. Mark done
      updateJobStatus(job, "completed", 100, "Complete");
      return;

    } catch (error) {
      if (attempt >= maxAttempts) {
        updateJobStatus(job, "failed", 0, error.message);
        throw error;
      }
    }
  }
}
```

### Zod Schemas for Typechecking

```typescript
// shared/artifact-schemas.ts
import { z } from "zod";

export const ResearchArtifactSchema = z.object({
  artifactType: z.literal("research"),
  jobId: z.string(),
  timestamp: z.string(),
  grants: z.array(z.object({
    title: z.string().min(1),
    funder: z.string().min(1),
    funderShort: z.string(),
    award: z.string().optional(),
    awardSort: z.number().optional(),
    deadline: z.string().optional(),
    deadlineConfidence: z.enum(["exact","estimated","rolling","unknown"]).optional(),
    eligibility: z.string().optional(),
    requirements: z.array(z.string()).optional(),
    externalUrl: z.string().url().optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()),
    category: z.string().optional(),
  })),
  evidence: z.array(z.object({
    grantTitle: z.string(),
    evidenceType: z.enum(["fit_score","deadline","award_amount","eligibility","requirements","giving_pattern"]),
    content: z.string(),
    sourceUrl: z.string().optional(),
  })),
  rationale: z.string().optional(),
  sourcesFound: z.number().int().min(0),
  grantsFound: z.number().int().min(0),
  errors: z.array(z.string()).optional(),
});

// ... same for DraftArtifactSchema, CrawlArtifactSchema, etc.
```

### OpenCode Prompt Template

The prompt we send to OpenCode must be explicit about:
1. What artifact to produce
2. Where to write it
3. The exact JSON schema
4. What to do on failure

```typescript
function buildPrompt(type: AgentTaskType, params: Record<string, unknown>, artifactPath: string): string {
  const schema = getSchemaDefinition(type);
  const context = getOrgContext(); // hardcoded Hacker Dojo profile

  return `
# Task: ${type}

## Context
${context}

## Instructions
${getInstructions(type, params)}

## OUTPUT REQUIREMENT — CRITICAL
You MUST write a single JSON file to this exact path:
${artifactPath}

The JSON must match this schema exactly:
\`\`\`json
${schema}
\`\`\`

## RULES
1. Write ONLY valid, parseable JSON. No markdown, no code fences, no explanatory text in the file.
2. Every field in the schema must be present (unless marked optional).
3. If you cannot complete the task, include an "errors" array explaining why.
4. Use double quotes for all strings. No trailing commas.
5. Do NOT write anything else to this file — only the JSON object.

## HARD FAILURE MODE
If the JSON at ${artifactPath} is invalid or doesn't match the schema,
I will ask you to retry with specific error details.
`;
}
```

## Async UI Representation

### Current Problem

Currently pressing a button like "Generate Draft" or "Run Discovery":
- No loading indicator
- No progress bar
- No stage indicator
- If it fails, no error message
- User is stuck waiting

### Required UI States

Every async operation must show:

```
┌─────────────────────────────────────────────────┐
│  ⏳ Researching grants from NSF...               │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  65%                   │
│  Stage: Analyzing results                        │
│  Source: nsf.gov                                 │
│                                                  │
│  [Cancel]  [View partial results]                │
└─────────────────────────────────────────────────┘
```

### Job Progress Component

```typescript
// frontend/src/components/JobProgress.tsx
interface JobProgressProps {
  jobId: string;
  jobType: "research" | "draft" | "crawl" | "match" | "extract";
  status: "queued" | "running" | "verifying" | "retrying" | "completed" | "failed" | "cancelled";
  progress: number; // 0-100
  stage: string;
  errorMessage?: string;
  retryCount?: number;
  onCancel: () => void;
  onRetry: () => void;
}
```

### Progress Stages Per Job Type

The OpenCode subprocess is a black box. The app MUST report only stages it can directly observe from the controller lifecycle. No fictional mid-process stages are allowed unless OpenCode writes a separate progress file.

| Job Type | Observable Stages |
|---|---|
| research | queued → preparing → running → verifying → completed |
| draft | queued → preparing → running → verifying → completed |
| crawl | queued → preparing → running → verifying → completed |
| match | queued → preparing → running → verifying → completed |
| extract | queued → preparing → running → verifying → completed |

If a future OpenCode version emits structured progress into `tmp/progress-{jobId}.json`, these stages may be refined. Until then, the UI MUST NOT imply insight into internal agent work such as "analyzing" or "ranking".

### Polling & Subscription

```typescript
// frontend/src/lib/useJobProgress.ts
export function useJobProgress(jobId: string) {
  // Poll /api/jobs/{jobId} every 2s while running
  // Show toast on completion or failure
  // Support cancellation via POST /api/jobs/{jobId}/cancel
}
```

## Tmp Directory Management

### Cache Cleanup Policy

```typescript
// server/cache-cleanup.ts

const TMP_DIR = path.join(DATA_DIR, "tmp");
const CACHE_DIR = path.join(TMP_DIR, ".cache");
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE_MB = 500;

// Run on app startup
export function cleanupTmpDir(): void {
  // 1. Remove completed job artifacts older than 24h
  // 2. Remove agent cache older than 7 days
  // 3. If cache > 500MB, remove oldest first
  // 4. Keep session logs for debugging (30 days)
  // 5. Never remove artifacts/ directory (persisted verified artifacts)
}

// Run periodically (every 6 hours)
export function periodicCleanup(): void {
  setInterval(cleanupTmpDir, 6 * 60 * 60 * 1000);
}
```

## Agent Communication Contract

### Subprocess Lifecycle Safeguards

- The controller records the spawned process PID in the job record.
- On startup, any job left in `running` or `verifying` state from a previous app crash is marked `failed`.
- If the recorded PID is still alive and matches an OpenCode process for that job, the app terminates it before accepting new jobs.
- Crawl jobs MUST honor per-source throttling settings from technical infrastructure (`crawl.requestDelayMs`, `crawl.respectRobotsTxt`, `crawl.userAgent`).

### What OpenCode MUST Do

1. Write structured JSON to the specified `$ARTIFACT_PATH`
2. Use exact schema — no extra fields, no missing required fields
3. On partial failure, include what succeeded + errors array
4. Never write markdown, prose, or explanatory text to the artifact file
5. Write session logs to `tmp/session-{jobId}.log` for debugging

### What OpenCode MUST NOT Do

1. Output results to stdout instead of writing the artifact file
2. Write partial/broken JSON
3. Invent new fields not in the schema
4. Use single quotes in JSON
5. Include trailing commas
6. Write multiple JSON objects to the file

### What The App DOES

1. Provides the artifact path via `ARTIFACT_PATH` env var
2. Validates JSON syntax (JSON.parse)
3. Validates against Zod schema
4. On failure: adds error details to prompt, retries (max 3 attempts)
5. On success: moves artifact to `artifacts/`, ingests into SQLite
6. Tracks all attempts in job record

## Implementation Checklist

- [ ] Define all artifact schemas in `shared/artifact-schemas.ts`
- [ ] Implement agent loop controller in `server/agent-loop.ts`
- [ ] Build prompt templates for each job type
- [ ] Implement progress polling API (`/api/jobs/{jobId}`)
- [ ] Build `JobProgress` React component with all states
- [ ] Implement tmp/cache cleanup on startup and periodic
- [ ] Wire existing "Generate Draft" and "Run Discovery" buttons to agent loop
- [ ] Test: agent returns valid JSON → ingested correctly
- [ ] Test: agent returns invalid JSON → retried with error feedback
- [ ] Test: agent fails 3 times → user sees actionable error message
- [ ] Test: user cancels mid-operation → artifact not ingested, tmp cleaned
