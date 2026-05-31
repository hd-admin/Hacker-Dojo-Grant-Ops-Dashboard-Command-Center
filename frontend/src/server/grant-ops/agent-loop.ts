import 'server-only';
/**
 * Agent Loop Controller
 *
 * Implements the typed-artifact agent loop pattern:
 * 1. Spawn OpenCode subprocess with timeout
 * 2. Wait for artifact file
 * 3. Parse & validate against Zod schema
 * 4. Retry up to 3 times on failure
 * 5. Apply quality gates
 * 6. Ingest into SQLite transactionally
 *
 * DI-compatible following dependencies.ts pattern.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type {
  AgentJob,
  AgentTaskType,
  JobProgressUpdate,
  JobStatus,
} from '../../../../shared/types';
import {
  BudgetImportArtifactSchema,
  CrawlArtifactSchema,
  DraftArtifactSchema,
  EligibilityVettingArtifactSchema,
  ExtractArtifactSchema,
  FunderInsightArtifactSchema,
  MatchArtifactSchema,
  PeerDiscoveryArtifactSchema,
  ResearchArtifactSchema,
} from '../../../../shared/artifact-schemas';

const MAX_RETRIES = 3;
const MAX_CONCURRENT_JOBS = 3;

const JOB_TIMEOUTS: Record<AgentTaskType, number> = {
  research: 120_000,
  draft: 300_000,
  crawl: 180_000,
  match: 60_000,
  extract: 60_000,
  'peer-discovery': 180_000,
  'funder-insights': 120_000,
  'eligibility-vetting': 60_000,
  'budget-import': 60_000,
};

const PROGRESS_STAGES: Record<AgentTaskType, { stage: string; progress: number }[]> = {
  research: [
    { stage: 'queued', progress: 0 },
    { stage: 'preparing', progress: 5 },
    { stage: 'searching', progress: 30 },
    { stage: 'analyzing', progress: 60 },
    { stage: 'writing-artifact', progress: 80 },
    { stage: 'verifying', progress: 90 },
    { stage: 'completed', progress: 100 },
  ],
  draft: [
    { stage: 'queued', progress: 0 },
    { stage: 'loading-context', progress: 5 },
    { stage: 'generating', progress: 40 },
    { stage: 'structuring', progress: 70 },
    { stage: 'writing-artifact', progress: 85 },
    { stage: 'verifying', progress: 95 },
    { stage: 'completed', progress: 100 },
  ],
  crawl: [
    { stage: 'queued', progress: 0 },
    { stage: 'connecting', progress: 5 },
    { stage: 'fetching', progress: 30 },
    { stage: 'parsing', progress: 60 },
    { stage: 'writing-artifact', progress: 80 },
    { stage: 'verifying', progress: 90 },
    { stage: 'completed', progress: 100 },
  ],
  match: [
    { stage: 'queued', progress: 0 },
    { stage: 'loading-grants', progress: 10 },
    { stage: 'analyzing-profile', progress: 40 },
    { stage: 'scoring', progress: 70 },
    { stage: 'writing-artifact', progress: 85 },
    { stage: 'verifying', progress: 95 },
    { stage: 'completed', progress: 100 },
  ],
  extract: [
    { stage: 'queued', progress: 0 },
    { stage: 'loading-document', progress: 10 },
    { stage: 'extracting', progress: 50 },
    { stage: 'writing-artifact', progress: 80 },
    { stage: 'verifying', progress: 90 },
    { stage: 'completed', progress: 100 },
  ],
  'peer-discovery': [
    { stage: 'queued', progress: 0 },
    { stage: 'researching', progress: 30 },
    { stage: 'analyzing', progress: 60 },
    { stage: 'writing-artifact', progress: 80 },
    { stage: 'verifying', progress: 90 },
    { stage: 'completed', progress: 100 },
  ],
  'funder-insights': [
    { stage: 'queued', progress: 0 },
    { stage: 'analyzing', progress: 30 },
    { stage: 'detecting-patterns', progress: 60 },
    { stage: 'writing-artifact', progress: 80 },
    { stage: 'verifying', progress: 90 },
    { stage: 'completed', progress: 100 },
  ],
  'eligibility-vetting': [
    { stage: 'queued', progress: 0 },
    { stage: 'checking', progress: 40 },
    { stage: 'writing-artifact', progress: 80 },
    { stage: 'verifying', progress: 90 },
    { stage: 'completed', progress: 100 },
  ],
  'budget-import': [
    { stage: 'queued', progress: 0 },
    { stage: 'extracting', progress: 40 },
    { stage: 'writing-artifact', progress: 80 },
    { stage: 'verifying', progress: 90 },
    { stage: 'completed', progress: 100 },
  ],
};

function getSchemaForType(type: AgentTaskType): z.ZodType {
  switch (type) {
    case 'research': return ResearchArtifactSchema;
    case 'draft': return DraftArtifactSchema;
    case 'crawl': return CrawlArtifactSchema;
    case 'match': return MatchArtifactSchema;
    case 'extract': return ExtractArtifactSchema;
    case 'peer-discovery': return PeerDiscoveryArtifactSchema;
    case 'funder-insights': return FunderInsightArtifactSchema;
    case 'eligibility-vetting': return EligibilityVettingArtifactSchema;
    case 'budget-import': return BudgetImportArtifactSchema;
  }
}

export interface AgentLoopDeps {
  getDataDir(): string;
  buildPrompt(type: AgentTaskType, params: Record<string, unknown>, artifactPath: string, retryFeedback?: string): string;
  updateJobProgress(jobId: string, update: JobProgressUpdate): Promise<void>;
  ingestArtifact(type: AgentTaskType, artifact: unknown, job: AgentJob): Promise<void>;
  opencodePath?: string;
  onLog?(jobId: string, line: string): void;
}

let activeJobs = 0;

export async function executeAgentJob(
  job: AgentJob,
  deps: AgentLoopDeps,
): Promise<void> {
  // Concurrent job gate
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    const update: JobProgressUpdate = {
      status: 'queued',
      progress: 0,
      stage: 'queued',
      retryCount: job.retryCount,
      maxRetries: MAX_RETRIES,
      errorMessage: `Max concurrent jobs (${MAX_CONCURRENT_JOBS}) reached. Job queued.`,
    };
    await deps.updateJobProgress(job.id, update);
    return;
  }

  activeJobs++;
  const dataDir = deps.getDataDir();
  const tmpDir = path.join(dataDir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const artifactPath = path.join(tmpDir, `${job.jobType}-${job.id}.json`);
  const sessionLogPath = path.join(tmpDir, `session-${job.id}.log`);
  const promptPath = path.join(tmpDir, `prompt-${job.id}.txt`);
  const timeoutMs = JOB_TIMEOUTS[job.jobType] || 120_000;

  const updateProgress = (status: JobStatus, progress: number, stage: string, retryCount: number, errorMessage?: string) => {
    const update: JobProgressUpdate = { status, progress, stage, retryCount, maxRetries: MAX_RETRIES };
    if (errorMessage !== undefined) {
      update.errorMessage = errorMessage;
    }
    void deps.updateJobProgress(job.id, update);
  };

  let retryFeedback: string | undefined;
  let _qualityWarning = false;
  const failureReasons: string[] = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    updateProgress('running', 0, PROGRESS_STAGES[job.jobType][1]?.stage || 'starting', attempt - 1);

    // Cleanup pre-existing tmp artifact before retry
    if (attempt > 1 && fs.existsSync(artifactPath)) {
      try {
        fs.unlinkSync(artifactPath);
      } catch {
        // ignore cleanup errors
      }
    }

    try {
      const prompt = deps.buildPrompt(job.jobType, job.params, artifactPath, retryFeedback);

      fs.mkdirSync(path.dirname(promptPath), { recursive: true });
      fs.writeFileSync(promptPath, prompt, 'utf-8');

      const logStream = fs.createWriteStream(sessionLogPath, { flags: attempt === 1 ? 'w' : 'a' });

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        ARTIFACT_PATH: artifactPath,
      };

      const opencodeBin = deps.opencodePath || 'opencode';
      let proc: ChildProcess;
      try {
        proc = spawn(opencodeBin, [], {
          env,
          cwd: tmpDir,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err) {
        activeJobs--;
        const msg = `Cannot spawn OpenCode: ${err instanceof Error ? err.message : String(err)}`;
        failureReasons.push(msg);
        updateProgress('failed', 0, 'error', attempt - 1,
          `Failed after ${MAX_RETRIES} attempts: ${failureReasons.join(' | ')}`);
        return;
      }

      // Record PID for orphan detection
      const processPid = proc.pid;
      if (processPid) {
        try {
          const { updateJobQueueItemPersistence } = await import('../../../../shared/grant-ops-persistence');
          await updateJobQueueItemPersistence(job.id, { processPid });
        } catch {
          // ignore PID recording errors
        }
      }

      try {
        proc.stdin?.write(prompt);
        proc.stdin?.end();
      } catch (writeErr) {
        const msg = writeErr instanceof Error ? writeErr.message : String(writeErr);
        if (msg.includes('EPIPE')) {
          logStream.write(`[stdin] Process exited before receiving input: ${msg}\n`);
        } else {
          throw writeErr;
        }
      }

      proc.stdin?.on('error', (streamErr) => {
        logStream.write(`[stdin-error] ${streamErr.message}\n`);
      });

      proc.on('error', (procErr) => {
        logStream.write(`[error] ${procErr.message}\n`);
      });

      if (proc.stdout) {
        proc.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          logStream.write(text);
          deps.onLog?.(job.id, text);
        });
      }
      if (proc.stderr) {
        proc.stderr.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          logStream.write(`[stderr] ${text}`);
          deps.onLog?.(job.id, `[stderr] ${text}`);
        });
      }

      const result = await new Promise<'completed' | 'timeout' | 'killed'>((resolve) => {
        const timer = setTimeout(() => resolve('timeout'), timeoutMs);
        const cancelChecker = setInterval(() => {
          if (job.status === 'cancelled') {
            clearInterval(cancelChecker);
            clearTimeout(timer);
            proc.kill('SIGTERM');
            setTimeout(() => { proc.kill('SIGKILL'); resolve('killed'); }, 5000);
          }
        }, 1000);

        proc.on('exit', () => {
          clearTimeout(timer);
          clearInterval(cancelChecker);
          resolve('completed');
        });

        proc.on('error', () => {
          clearTimeout(timer);
          clearInterval(cancelChecker);
          resolve('completed');
        });
      });

      logStream.end();

      if (result === 'timeout') {
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 5000);
        retryFeedback = `Previous attempt timed out after ${timeoutMs / 1000}s.`;
        updateProgress('retrying', 0, 'timeout', attempt - 1, retryFeedback);
        continue;
      }

      if (result === 'killed') {
        updateProgress('cancelled', 0, 'cancelled', attempt - 1);
        return;
      }

      updateProgress('verifying', 80, 'verifying', attempt - 1);

      if (!fs.existsSync(artifactPath)) {
        retryFeedback = `Agent did not produce an artifact file at ${artifactPath}. You MUST write valid JSON to this exact path.`;
        failureReasons.push(retryFeedback);
        updateProgress('retrying', 30, 'artifact-missing', attempt - 1, retryFeedback);
        continue;
      }

      // Check mtime against attempt start to detect stale artifacts
      const attemptStart = Date.now();
      const stats = fs.statSync(artifactPath);
      if (stats.mtimeMs < attemptStart - timeoutMs) {
        retryFeedback = `Artifact file at ${artifactPath} is stale (mtime ${new Date(stats.mtimeMs).toISOString()}). The agent may have crashed.`;
        failureReasons.push(retryFeedback);
        updateProgress('retrying', 35, 'stale-artifact', attempt - 1, retryFeedback);
        continue;
      }

      const raw = fs.readFileSync(artifactPath, 'utf-8');
      let artifact: unknown;
      try {
        artifact = JSON.parse(raw);
      } catch (parseErr) {
        retryFeedback = `The file at ${artifactPath} contained invalid JSON. Error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. Ensure valid JSON output.`;
        failureReasons.push(retryFeedback);
        updateProgress('retrying', 40, 'invalid-json', attempt - 1, retryFeedback);
        continue;
      }

      const schema = getSchemaForType(job.jobType);
      const parseResult = schema.safeParse(artifact);
      if (!parseResult.success) {
        const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        retryFeedback = `Schema validation errors: ${errors}. Fix these issues.`;
        updateProgress('retrying', 50, 'schema-mismatch', attempt - 1, retryFeedback);
        continue;
      }

      const validated = parseResult.data as Record<string, unknown>;
      const qualityResult = checkQualityGates(job.jobType, validated);

      if (!qualityResult.passed && attempt < MAX_RETRIES) {
        retryFeedback = qualityResult.feedback;
        failureReasons.push(retryFeedback);
        updateProgress('retrying', 60, 'quality-failed', attempt - 1, retryFeedback);
        continue;
      }

      if (!qualityResult.passed) {
        _qualityWarning = true;
        failureReasons.push(qualityResult.feedback);
      }

      const artifactsDir = path.join(dataDir, 'artifacts', `${job.jobType}s`);
      fs.mkdirSync(artifactsDir, { recursive: true });
      fs.writeFileSync(path.join(artifactsDir, `${job.id}.json`), JSON.stringify(validated, null, 2));

      await deps.ingestArtifact(job.jobType, validated, job);
      activeJobs--;
      updateProgress('completed', 100, 'completed', attempt - 1);
      return;

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      failureReasons.push(errMsg);
      if (attempt >= MAX_RETRIES) {
        activeJobs--;
        updateProgress('failed', 0, 'failed', attempt - 1,
          `Failed after ${MAX_RETRIES} attempts: ${failureReasons.join(' | ')}. Check session log at ${sessionLogPath}`);
        return;
      }
      retryFeedback = `Unexpected error: ${errMsg}`;
      updateProgress('retrying', 0, 'error', attempt - 1, retryFeedback);
    }
  }

  // Exhausted all retries without success (via continue for invalid JSON, missing artifact, etc.)
  activeJobs--;
  updateProgress('failed', 0, 'failed', MAX_RETRIES,
    `Failed after ${MAX_RETRIES} attempts: ${failureReasons.join(' | ')}. Check session log at ${sessionLogPath}`);
}

interface QualityGateResult {
  passed: boolean;
  feedback: string;
}

export function checkQualityGates(type: AgentTaskType, artifact: Record<string, unknown>): QualityGateResult {
  switch (type) {
    case 'research': {
      const grants = artifact.grants as unknown[];
      const errors = artifact.errors as string[] | undefined;
      if ((!grants || grants.length === 0) && (!errors || errors.length === 0)) {
        return { passed: false, feedback: 'No grants found and no errors reported. If the source has no grants, explain why in the errors array.' };
      }
      return { passed: true, feedback: '' };
    }
    case 'draft': {
      const wordCount = artifact.wordCount as number;
      const sections = artifact.sections as Array<{ isGrounded: boolean }> | undefined;
      if (wordCount < 500) {
        return { passed: false, feedback: `Draft too short (${wordCount} words). Generate at least 500 words across all sections.` };
      }
      if (sections && !sections.some(s => s.isGrounded)) {
        return { passed: false, feedback: 'No sections are grounded. Reference specific Hacker Dojo documents in groundingSources.' };
      }
      return { passed: true, feedback: '' };
    }
    case 'match': {
      const matches = artifact.matches as Array<{ fitScore: number }> | undefined;
      if (matches && matches.length > 1) {
        const scores = matches.map(m => m.fitScore);
        if (scores.every(s => s === scores[0])) {
          return { passed: false, feedback: 'All grants received identical scores. Differentiate based on actual alignment.' };
        }
      }
      return { passed: true, feedback: '' };
    }
    case 'extract': {
      const extracted = artifact.extracted as Record<string, unknown> | undefined;
      const errors = artifact.errors as string[] | undefined;
      if ((!extracted?.amount) && (!errors || errors.length === 0)) {
        return { passed: false, feedback: 'No amount extracted and no errors reported. Either find the amount or explain why it couldn\'t be extracted.' };
      }
      return { passed: true, feedback: '' };
    }
    case 'peer-discovery': {
      const results = artifact.results as unknown[];
      const errors = artifact.errors as string[] | undefined;
      if ((!results || results.length === 0) && (!errors || errors.length === 0)) {
        return { passed: false, feedback: 'No peer funders found and no errors reported. Explain why in the errors array.' };
      }
      return { passed: true, feedback: '' };
    }
    case 'funder-insights': {
      const patterns = artifact.patterns as unknown[];
      const errors = artifact.errors as string[] | undefined;
      if ((!patterns || patterns.length === 0) && (!errors || errors.length === 0)) {
        return { passed: false, feedback: 'No patterns found and no errors reported. Explain why in the errors array.' };
      }
      return { passed: true, feedback: '' };
    }
    case 'budget-import': {
      const categories = artifact.categories as unknown[];
      const errors = artifact.errors as string[] | undefined;
      if ((!categories || categories.length === 0) && (!errors || errors.length === 0)) {
        return { passed: false, feedback: 'No budget categories found and no errors reported. Explain why in the errors array.' };
      }
      return { passed: true, feedback: '' };
    }
    default:
      return { passed: true, feedback: '' };
  }
}

export { MAX_RETRIES, JOB_TIMEOUTS, PROGRESS_STAGES };
