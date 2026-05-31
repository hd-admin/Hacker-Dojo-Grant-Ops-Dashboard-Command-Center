/**
 * Agent Loop Unit Tests (v2)
 *
 * Tests executeAgentJob with mocked child_process.spawn.
 * Covers all AC-13.2.1 scenarios:
 * 1. Successful artifact generation and ingestion
 * 2. Invalid JSON -> retry -> success on 2nd attempt
 * 3. 3 consecutive failures -> final failure
 * 4. Timeout -> retry
 * 5. Cancellation mid-operation
 * 6. Missing artifact file after process exit
 * 7. Schema validation failure with error propagation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { Writable, Readable } from 'node:stream';
import type { AgentJob, AgentTaskType } from '../../../../shared/types';
import { executeAgentJob, MAX_RETRIES, JOB_TIMEOUTS, PROGRESS_STAGES } from './agent-loop';
import type { AgentLoopDeps } from './agent-loop';

const TEST_DATA_DIR = path.join(process.cwd(), '.grant-ops-data-test-agent-loop-v2');

// Shared spawn mock setup
const mockSpawnImpl = vi.fn();

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    spawn: (...args: unknown[]) => mockSpawnImpl(...args),
  };
});

function buildValidResearchArtifact(jobId: string) {
  return {
    artifactType: 'research',
    jobId,
    timestamp: new Date().toISOString(),
    grants: [
      {
        title: 'Community Innovation Grant',
        funder: 'Test Foundation',
        funderShort: 'TF',
        award: '$50,000',
        deadline: '2026-12-31',
        tags: ['innovation', 'community'],
        category: 'education',
        externalUrl: 'https://example.com/grant',
        eligibility: 'Nonprofits in California',
      },
    ],
    evidence: [
      {
        grantTitle: 'Community Innovation Grant',
        evidenceType: 'fit_score',
        content: 'Strong alignment with org mission',
      },
    ],
    sourcesFound: 1,
    grantsFound: 1,
    errors: [],
  };
}

function writeArtifactToPath(artifactPath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(data));
}

function createMockChildProcess() {
  const mockProc = new EventEmitter() as EventEmitter & {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
    pid: number;
    kill: Mock;
  };

  mockProc.stdin = new Writable({
    write(_chunk: Buffer, _encoding: BufferEncoding, callback: () => void) {
      callback();
    },
  });
  mockProc.stdout = new Readable({ read(): void {} });
  mockProc.stderr = new Readable({ read(): void {} });
  mockProc.pid = 12345;
  mockProc.kill = vi.fn();

  return mockProc;
}

function createMockDeps(overrides?: Partial<AgentLoopDeps>): {
  deps: AgentLoopDeps;
  updateProgressCalls: Array<{ status: string; stage: string; errorMessage?: string | undefined }>;
  ingestCalls: Array<{ type: AgentTaskType; artifact: unknown; job: AgentJob }>;
} {
  const updateProgressCalls: Array<{ status: string; stage: string; errorMessage?: string | undefined }> = [];
  const ingestCalls: Array<{ type: AgentTaskType; artifact: unknown; job: AgentJob }> = [];

  const deps: AgentLoopDeps = {
    getDataDir() {
      return TEST_DATA_DIR;
    },
    buildPrompt() {
      return 'Build artifact.';
    },
    async updateJobProgress(_jobId, update) {
      updateProgressCalls.push({
        status: update.status,
        stage: update.stage || '',
        errorMessage: update.errorMessage ?? undefined,
      });
    },
    async ingestArtifact(type, artifact, job) {
      ingestCalls.push({ type, artifact, job });
    },
    opencodePath: 'opencode',
    ...overrides,
  };

  return { deps, updateProgressCalls, ingestCalls };
}

function createResearchJob(overrides?: Partial<AgentJob>): AgentJob {
  return {
    id: 'test-job-001',
    jobType: 'research',
    params: {},
    status: 'queued',
    progress: 0,
    stage: 'queued',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('executeAgentJob - mocked subprocess', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    fs.mkdirSync(path.join(TEST_DATA_DIR, 'tmp'), { recursive: true });
    mockSpawnImpl.mockReset();
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  it('1 - successful artifact generation and ingestion (AC-13.2.1)', async () => {
    const mockProc = createMockChildProcess();
    mockSpawnImpl.mockReturnValue(mockProc);

    const job = createResearchJob();
    const { deps, ingestCalls } = createMockDeps();

    const artifactPath = path.join(TEST_DATA_DIR, 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    await flushPromises();
    writeArtifactToPath(artifactPath, buildValidResearchArtifact(job.id));
    mockProc.emit('exit', 0);

    await execPromise;

    expect(ingestCalls.length).toBeGreaterThanOrEqual(1);
    if (ingestCalls[0]) {
      expect(ingestCalls[0].type).toBe('research');
    }
  });

  it('2 - invalid JSON on 1st attempt, succeeds on 2nd (AC-13.2.1)', async () => {
    const mockProc1 = createMockChildProcess();
    const mockProc2 = createMockChildProcess();
    mockSpawnImpl.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

    const job = createResearchJob();
    const { deps, ingestCalls } = createMockDeps();

    const artifactPath = path.join(TEST_DATA_DIR, 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    await flushPromises();
    writeArtifactToPath(artifactPath, 'not valid json {{{');
    mockProc1.emit('exit', 0);
    await flushPromises();
    await flushPromises();

    writeArtifactToPath(artifactPath, buildValidResearchArtifact(job.id));
    mockProc2.emit('exit', 0);

    await execPromise;

    expect(ingestCalls.length).toBe(1);
    expect(mockSpawnImpl).toHaveBeenCalledTimes(2);
  });

  it('3 - 3 consecutive invalid JSON -> final failure (AC-13.2.1)', async () => {
    const mockProc1 = createMockChildProcess();
    const mockProc2 = createMockChildProcess();
    const mockProc3 = createMockChildProcess();
    mockSpawnImpl
      .mockReturnValueOnce(mockProc1)
      .mockReturnValueOnce(mockProc2)
      .mockReturnValueOnce(mockProc3);

    const job = createResearchJob();
    const { deps, updateProgressCalls, ingestCalls } = createMockDeps();

    const artifactPath = path.join(TEST_DATA_DIR, 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    for (const proc of [mockProc1, mockProc2, mockProc3]) {
      await flushPromises();
      writeArtifactToPath(artifactPath, 'not valid json {{{');
      proc.emit('exit', 0);
      await flushPromises();
      await flushPromises();
    }

    await execPromise;

    expect(ingestCalls.length).toBe(0);
    expect(mockSpawnImpl).toHaveBeenCalledTimes(3);
    const failedUpdate = updateProgressCalls.find((u) => u.status === 'failed');
    expect(failedUpdate).toBeDefined();
    if (failedUpdate) {
      expect(failedUpdate.errorMessage).toContain('attempts');
    }
  }, 10000);

  it('4 - timeout -> retry on 2nd attempt (AC-13.2.1)', async () => {
    // Use real timers but override the research timeout via module-level mock
    const agentLoopModule = await import('./agent-loop');
    const originalTimeout = agentLoopModule.JOB_TIMEOUTS.research;
    (agentLoopModule.JOB_TIMEOUTS as Record<string, number>).research = 50;

    try {
      const mockProc1 = createMockChildProcess();
      const mockProc2 = createMockChildProcess();
      mockSpawnImpl.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

      const job = createResearchJob();
      const { deps, ingestCalls } = createMockDeps();

      const artifactPath = path.join(TEST_DATA_DIR, 'tmp', `research-${job.id}.json`);

      const execPromise = executeAgentJob(job, deps);

      // Wait a bit for the timeout to trigger on process 1
      await new Promise((r) => setTimeout(r, 100));

      // Second attempt: exit with valid artifact
      writeArtifactToPath(artifactPath, buildValidResearchArtifact(job.id));
      mockProc2.emit('exit', 0);

      await execPromise;

      expect(ingestCalls.length).toBe(1);
      expect(mockProc1.kill).toHaveBeenCalled();
      expect(mockSpawnImpl).toHaveBeenCalledTimes(2);
    } finally {
      (agentLoopModule.JOB_TIMEOUTS as Record<string, number>).research = originalTimeout;
    }
  });

  it('5 - cancellation mid-operation (AC-13.2.1)', async () => {
    vi.useFakeTimers();

    try {
      const mockProc = createMockChildProcess();
      mockSpawnImpl.mockReturnValue(mockProc);

      const job = createResearchJob({ status: 'running' });
      const { deps, updateProgressCalls, ingestCalls } = createMockDeps();

      const execPromise = executeAgentJob(job, deps);

      await vi.advanceTimersByTimeAsync(0);

      // Mark job as cancelled, then advance past the 1s interval check
      job.status = 'cancelled';
      await vi.advanceTimersByTimeAsync(1100);

      // Advance the 5s SIGKILL timer
      await vi.advanceTimersByTimeAsync(5100);

      await execPromise;

      expect(ingestCalls.length).toBe(0);
      const cancelledUpdate = updateProgressCalls.find((u) => u.status === 'cancelled');
      expect(cancelledUpdate).toBeDefined();
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    } finally {
      vi.useRealTimers();
    }
  });

  it('6 - missing artifact file after process exit -> retry (AC-13.2.1)', async () => {
    const mockProc1 = createMockChildProcess();
    const mockProc2 = createMockChildProcess();
    mockSpawnImpl.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

    const job = createResearchJob();
    const { deps, updateProgressCalls, ingestCalls } = createMockDeps();

    const artifactPath = path.join(TEST_DATA_DIR, 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    // First attempt: exit without writing artifact file
    await flushPromises();
    mockProc1.emit('exit', 0);
    await flushPromises();
    await flushPromises();

    // Second attempt: write valid artifact
    writeArtifactToPath(artifactPath, buildValidResearchArtifact(job.id));
    mockProc2.emit('exit', 0);

    await execPromise;

    expect(ingestCalls.length).toBe(1);
    const retryUpdate = updateProgressCalls.find(
      (u) => u.status === 'retrying' && u.errorMessage?.includes('did not produce'),
    );
    expect(retryUpdate).toBeDefined();
  }, 10000);

  it('7 - schema validation failure with error propagation (AC-13.2.1)', async () => {
    const mockProc1 = createMockChildProcess();
    const mockProc2 = createMockChildProcess();
    mockSpawnImpl.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

    const job = createResearchJob();
    const { deps, updateProgressCalls, ingestCalls } = createMockDeps();

    const artifactPath = path.join(TEST_DATA_DIR, 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    // First attempt: write JSON that fails schema validation
    await flushPromises();
    writeArtifactToPath(artifactPath, {
      artifactType: 'research',
      jobId: job.id,
      timestamp: new Date().toISOString(),
      grants: [{ title: 123, funder: 'x' }],
      evidence: [],
      sourcesFound: 0,
      grantsFound: 0,
    });
    mockProc1.emit('exit', 0);
    await flushPromises();
    await flushPromises();

    // Second attempt: write valid artifact
    writeArtifactToPath(artifactPath, buildValidResearchArtifact(job.id));
    mockProc2.emit('exit', 0);

    await execPromise;

    expect(ingestCalls.length).toBe(1);
    const schemaRetry = updateProgressCalls.find(
      (u) => u.stage === 'schema-mismatch',
    );
    expect(schemaRetry).toBeDefined();
    expect(schemaRetry!.errorMessage).toContain('Schema validation');
  }, 10000);
});

describe('agent-loop constants', () => {
  it('has max retries set to 3', () => {
    expect(MAX_RETRIES).toBe(3);
  });

  it('has timeout for each job type', () => {
    expect(JOB_TIMEOUTS.research).toBe(120000);
    expect(JOB_TIMEOUTS.draft).toBe(300000);
    expect(JOB_TIMEOUTS.crawl).toBe(180000);
    expect(JOB_TIMEOUTS.match).toBe(60000);
    expect(JOB_TIMEOUTS.extract).toBe(60000);
    expect(JOB_TIMEOUTS['peer-discovery']).toBe(180000);
    expect(JOB_TIMEOUTS['funder-insights']).toBe(120000);
    expect(JOB_TIMEOUTS['eligibility-vetting']).toBe(60000);
    expect(JOB_TIMEOUTS['budget-import']).toBe(60000);
  });

  it('has progress stages for each job type', () => {
    for (const type of Object.keys(PROGRESS_STAGES)) {
      const stages = PROGRESS_STAGES[type as keyof typeof PROGRESS_STAGES];
      expect(stages).toBeDefined();
      expect(stages.length).toBeGreaterThan(0);
      const last = stages[stages.length - 1];
      expect(last?.progress).toBe(100);
      expect(last?.stage).toBe('completed');
    }
  });
});
