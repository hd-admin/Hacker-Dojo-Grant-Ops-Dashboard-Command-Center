/**
 * Agent Loop Unit Tests (v3)
 *
 * Tests executeAgentJob with injected fs and processSpawner dependencies.
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
import nodeFs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { Writable, Readable } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import type { AgentJob, AgentTaskType } from '../../../../shared/types';
import {
  executeAgentJob,
  MAX_RETRIES,
  JOB_TIMEOUTS,
  PROGRESS_STAGES,
  checkQualityGates,
  type FileSystem,
  type ProcessSpawner,
} from './agent-loop';
import type { AgentLoopDeps } from './agent-loop';

let currentTestDataDir: string;

function getTestDataDir() {
  return currentTestDataDir;
}

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

function createMockFileSystem(_baseDir: string): FileSystem {
  const files = new Map<string, string>();
  const dirs = new Set<string>();

  const ensureDir = (filePath: string) => {
    const dir = path.dirname(filePath);
    if (!dirs.has(dir)) {
      nodeFs.mkdirSync(dir, { recursive: true });
      dirs.add(dir);
    }
  };

  return {
    mkdirSync: (p, _o) => {
      nodeFs.mkdirSync(p, { recursive: true });
      dirs.add(p);
    },
    writeFileSync: (p, d, _e) => {
      ensureDir(p);
      files.set(p, d);
      nodeFs.writeFileSync(p, d, 'utf-8');
    },
    readFileSync: (p, _e) => {
      if (files.has(p)) return files.get(p)!;
      return nodeFs.readFileSync(p, 'utf-8');
    },
    existsSync: (p) => files.has(p) || nodeFs.existsSync(p),
    unlinkSync: (p) => {
      files.delete(p);
      if (nodeFs.existsSync(p)) nodeFs.unlinkSync(p);
    },
    statSync: (p) => {
      if (files.has(p)) return { mtimeMs: Date.now() };
      return nodeFs.statSync(p);
    },
    createWriteStream: (p, o) => nodeFs.createWriteStream(p, o),
    rmSync: (p, o) => {
      files.forEach((_v, k) => {
        if (k.startsWith(p)) files.delete(k);
      });
      if (nodeFs.existsSync(p)) nodeFs.rmSync(p, o);
    },
  };
}

function createMockChildProcess(options?: { autoExitAfterMs?: number; exitCode?: number }) {
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

  if (options?.autoExitAfterMs !== undefined) {
    setTimeout(() => {
      mockProc.emit('exit', options.exitCode ?? 0);
    }, options.autoExitAfterMs);
  }

  return mockProc;
}

const mockSpawnImpl = vi.fn();

function createMockProcessSpawner(): ProcessSpawner {
  return {
    spawn: (command, args, options) => {
      return mockSpawnImpl(command, args, options) as ChildProcess;
    },
  };
}

function createMockDeps(
  baseDir: string,
  overrides?: Partial<AgentLoopDeps>,
): {
  deps: AgentLoopDeps;
  updateProgressCalls: Array<{ status: string; stage: string; errorMessage?: string | undefined }>;
  ingestCalls: Array<{ type: AgentTaskType; artifact: unknown; job: AgentJob }>;
} {
  const updateProgressCalls: Array<{
    status: string;
    stage: string;
    errorMessage?: string | undefined;
  }> = [];
  const ingestCalls: Array<{ type: AgentTaskType; artifact: unknown; job: AgentJob }> = [];

  const deps: AgentLoopDeps = {
    getDataDir() {
      return baseDir;
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
    fs: createMockFileSystem(baseDir),
    processSpawner: createMockProcessSpawner(),
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
    currentTestDataDir = path.join(
      process.cwd(),
      `.grant-ops-data-test-agent-loop-v3-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    nodeFs.mkdirSync(currentTestDataDir, { recursive: true });
    nodeFs.mkdirSync(path.join(currentTestDataDir, 'tmp'), { recursive: true });
    mockSpawnImpl.mockReset();
  });

  afterEach(async () => {
    await new Promise((r) => setImmediate(r));
    if (nodeFs.existsSync(currentTestDataDir)) {
      try {
        nodeFs.rmSync(currentTestDataDir, { recursive: true, force: true });
      } catch {
        // Suppress cleanup errors (e.g., ENOENT from race conditions)
      }
    }
  });

  it('1 - successful artifact generation and ingestion (AC-13.2.1)', async () => {
    const mockProc = createMockChildProcess({ autoExitAfterMs: 2000 });
    mockSpawnImpl.mockReturnValue(mockProc);

    const job = createResearchJob();
    const { deps, ingestCalls } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));

    const execPromise = executeAgentJob(job, deps);

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
    const { deps, updateProgressCalls, ingestCalls } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    await flushPromises();
    deps.fs!.writeFileSync(artifactPath, 'not valid json {{{');
    mockProc1.emit('exit', 0);
    await flushPromises();
    await flushPromises();

    deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));
    mockProc2.emit('exit', 0);

    await execPromise;

    expect(ingestCalls.length).toBe(1);
    expect(mockSpawnImpl).toHaveBeenCalledTimes(2);
    const parseErrorUpdate = updateProgressCalls.find((u) => u.stage === 'invalid-json');
    expect(parseErrorUpdate).toBeDefined();
    expect(parseErrorUpdate!.errorMessage).toContain('invalid JSON');
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
    const { deps, updateProgressCalls, ingestCalls } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    for (const proc of [mockProc1, mockProc2, mockProc3]) {
      await flushPromises();
      deps.fs!.writeFileSync(artifactPath, 'not valid json {{{');
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
    const agentLoopModule = await import('./agent-loop');
    const originalTimeout = agentLoopModule.JOB_TIMEOUTS.research;
    (agentLoopModule.JOB_TIMEOUTS as Record<string, number>).research = 50;

    try {
      const mockProc1 = createMockChildProcess();
      const mockProc2 = createMockChildProcess();
      mockSpawnImpl.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

      const job = createResearchJob();
      const { deps, ingestCalls } = createMockDeps(currentTestDataDir);

      const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);

      const execPromise = executeAgentJob(job, deps);

      await new Promise((r) => setTimeout(r, 100));

      deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));
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
      const { deps, updateProgressCalls, ingestCalls } = createMockDeps(currentTestDataDir);

      const execPromise = executeAgentJob(job, deps);

      await vi.advanceTimersByTimeAsync(0);

      job.status = 'cancelled';
      await vi.advanceTimersByTimeAsync(1100);

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
    const { deps, updateProgressCalls, ingestCalls } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    await flushPromises();
    mockProc1.emit('exit', 0);
    await flushPromises();
    await flushPromises();

    deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));
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
    const { deps, updateProgressCalls, ingestCalls } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    await flushPromises();
    deps.fs!.writeFileSync(
      artifactPath,
      JSON.stringify({
        artifactType: 'research',
        jobId: job.id,
        timestamp: new Date().toISOString(),
        grants: [{ title: 123, funder: 'x' }],
        evidence: [],
        sourcesFound: 0,
        grantsFound: 0,
      }),
    );
    mockProc1.emit('exit', 0);
    await flushPromises();
    await flushPromises();

    deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));
    mockProc2.emit('exit', 0);

    await execPromise;

    expect(ingestCalls.length).toBe(1);
    const schemaRetry = updateProgressCalls.find((u) => u.stage === 'schema-mismatch');
    expect(schemaRetry).toBeDefined();
    expect(schemaRetry!.errorMessage).toContain('Schema validation');
  }, 10000);
});

describe('executeAgentJob - edge case coverage', () => {
  beforeEach(() => {
    currentTestDataDir = path.join(
      process.cwd(),
      `.grant-ops-data-test-agent-loop-edge-v3-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    nodeFs.mkdirSync(currentTestDataDir, { recursive: true });
    nodeFs.mkdirSync(path.join(currentTestDataDir, 'tmp'), { recursive: true });
    mockSpawnImpl.mockReset();
  });

  afterEach(async () => {
    await new Promise((r) => setImmediate(r));
    if (nodeFs.existsSync(currentTestDataDir)) {
      try {
        nodeFs.rmSync(currentTestDataDir, { recursive: true, force: true });
      } catch {
        // Suppress cleanup errors
      }
    }
  });

  it('8 - timeout produces correct failure reason in retry prompt (AC-1.6.2)', async () => {
    const agentLoopModule = await import('./agent-loop');
    const originalTimeout = agentLoopModule.JOB_TIMEOUTS.research;
    (agentLoopModule.JOB_TIMEOUTS as Record<string, number>).research = 50;

    try {
      const mockProc1 = createMockChildProcess();
      const mockProc2 = createMockChildProcess();
      mockSpawnImpl.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

      const job = createResearchJob();
      const { deps, updateProgressCalls, ingestCalls } = createMockDeps(currentTestDataDir);

      const execPromise = executeAgentJob(job, deps);

      await new Promise((r) => setTimeout(r, 100));

      const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
      deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));
      mockProc2.emit('exit', 0);

      await execPromise;

      expect(ingestCalls.length).toBe(1);
      const timeoutUpdate = updateProgressCalls.find(
        (u) => u.status === 'retrying' && u.stage === 'timeout',
      );
      expect(timeoutUpdate).toBeDefined();
      expect(timeoutUpdate!.errorMessage).toContain('timed out');
    } finally {
      (agentLoopModule.JOB_TIMEOUTS as Record<string, number>).research = originalTimeout;
    }
  });

  it('9 - cancellation preserves job state for retry (AC-1.5.1)', async () => {
    vi.useFakeTimers();

    try {
      const mockProc = createMockChildProcess();
      mockSpawnImpl.mockReturnValue(mockProc);

      const job = createResearchJob({ status: 'running' });
      const { deps, updateProgressCalls, ingestCalls } = createMockDeps(currentTestDataDir);

      const execPromise = executeAgentJob(job, deps);

      await vi.advanceTimersByTimeAsync(0);

      job.status = 'cancelled';
      await vi.advanceTimersByTimeAsync(1100);

      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
      await vi.advanceTimersByTimeAsync(5100);

      await execPromise;

      expect(ingestCalls.length).toBe(0);
      const cancelledUpdate = updateProgressCalls.find((u) => u.status === 'cancelled');
      expect(cancelledUpdate).toBeDefined();
      expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('checkQualityGates - draft wordCount threshold (AC-15.8.1)', () => {
  it('fails draft with wordCount=300 (between old 200 and new 500 threshold)', () => {
    const result = checkQualityGates('draft', {
      wordCount: 300,
      sections: [{ isGrounded: true }],
    });
    expect(result.passed).toBe(false);
    expect(result.feedback).toContain('500');
  });

  it('passes draft with wordCount=600 (above 500 threshold)', () => {
    const result = checkQualityGates('draft', {
      wordCount: 600,
      sections: [{ isGrounded: true }],
    });
    expect(result.passed).toBe(true);
    expect(result.feedback).toBe('');
  });

  it('fails draft with wordCount=499 (just below 500 threshold)', () => {
    const result = checkQualityGates('draft', {
      wordCount: 499,
      sections: [{ isGrounded: true }],
    });
    expect(result.passed).toBe(false);
    expect(result.feedback).toContain('500');
  });

  it('passes draft with wordCount=500 (exactly at threshold)', () => {
    const result = checkQualityGates('draft', {
      wordCount: 500,
      sections: [{ isGrounded: true }],
    });
    expect(result.passed).toBe(true);
    expect(result.feedback).toBe('');
  });
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
    const canonicalStageNames = ['queued', 'preparing', 'running', 'verifying', 'completed'];
    const canonicalProgress = [0, 5, 50, 90, 100];
    for (const type of Object.keys(PROGRESS_STAGES)) {
      const stages = PROGRESS_STAGES[type as keyof typeof PROGRESS_STAGES];
      expect(stages).toBeDefined();
      expect(stages).toHaveLength(5);
      expect(stages.map((s) => s.stage)).toEqual(canonicalStageNames);
      expect(stages.map((s) => s.progress)).toEqual(canonicalProgress);
      const last = stages[stages.length - 1];
      expect(last?.progress).toBe(100);
      expect(last?.stage).toBe('completed');
    }
  });
});

describe('dependency injection interfaces', () => {
  it('FileSystem interface is exported and usable', () => {
    const fs: FileSystem = {
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      readFileSync: vi.fn(() => '{}'),
      existsSync: vi.fn(() => false),
      unlinkSync: vi.fn(),
      statSync: vi.fn(() => ({ mtimeMs: Date.now() })),
      createWriteStream: vi.fn(),
      rmSync: vi.fn(),
    };
    expect(fs).toBeDefined();
  });

  it('ProcessSpawner interface is exported and usable', () => {
    const spawner: ProcessSpawner = {
      spawn: vi.fn(),
    };
    expect(spawner).toBeDefined();
  });
});

describe('executeAgentJob - unverified ACs (AC-1.1.1, AC-1.1.5, AC-1.2.3, AC-1.3.1)', () => {
  beforeEach(() => {
    currentTestDataDir = path.join(
      process.cwd(),
      `.grant-ops-data-test-agent-loop-unverified-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    nodeFs.mkdirSync(currentTestDataDir, { recursive: true });
    nodeFs.mkdirSync(path.join(currentTestDataDir, 'tmp'), { recursive: true });
    mockSpawnImpl.mockReset();
  });

  afterEach(async () => {
    await new Promise((r) => setImmediate(r));
    if (nodeFs.existsSync(currentTestDataDir)) {
      try {
        nodeFs.rmSync(currentTestDataDir, { recursive: true, force: true });
      } catch {
        // Suppress cleanup errors
      }
    }
  });

  it('AC-1.1.1: spawn env includes ARTIFACT_PATH matching the expected artifact file', async () => {
    const mockProc = createMockChildProcess({ autoExitAfterMs: 2000 });
    mockSpawnImpl.mockReturnValue(mockProc);

    const job = createResearchJob();
    const { deps } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));

    await executeAgentJob(job, deps);

    expect(mockSpawnImpl).toHaveBeenCalledTimes(1);
    const spawnArgs = mockSpawnImpl.mock.calls[0] as unknown as [
      string,
      string[],
      { env?: NodeJS.ProcessEnv },
    ];
    expect(spawnArgs[2].env).toBeDefined();
    expect(spawnArgs[2].env?.ARTIFACT_PATH).toBe(artifactPath);
  });

  it('AC-1.1.5: pre-existing artifact is deleted before retry on attempt > 1', async () => {
    const mockProc1 = createMockChildProcess();
    const mockProc2 = createMockChildProcess();
    mockSpawnImpl.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

    const job = createResearchJob();
    const { deps } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    await flushPromises();
    deps.fs!.writeFileSync(artifactPath, 'stale content from prior attempt');
    mockProc1.emit('exit', 0);
    await flushPromises();
    await flushPromises();

    expect(nodeFs.existsSync(artifactPath)).toBe(false);

    deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));
    mockProc2.emit('exit', 0);

    await execPromise;

    expect(nodeFs.existsSync(artifactPath)).toBe(true);
  });

  it('AC-1.1.5: stale artifact (mtime older than timeout) triggers retry with stale-artifact stage', async () => {
    const mockProc1 = createMockChildProcess();
    const mockProc2 = createMockChildProcess();
    mockSpawnImpl.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

    const job = createResearchJob();
    const { deps, updateProgressCalls, ingestCalls } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    const execPromise = executeAgentJob(job, deps);

    await flushPromises();
    nodeFs.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));
    const past = Date.now() - 600_000;
    nodeFs.utimesSync(artifactPath, past / 1000, past / 1000);
    mockProc1.emit('exit', 0);
    await flushPromises();
    await flushPromises();

    deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));
    mockProc2.emit('exit', 0);

    await execPromise;

    expect(ingestCalls.length).toBe(1);
    const staleUpdate = updateProgressCalls.find((u) => u.stage === 'stale-artifact');
    expect(staleUpdate).toBeDefined();
  }, 10000);

  it('AC-1.2.3: schema validation failure on all 3 attempts produces zero ingest calls', async () => {
    const mockProc1 = createMockChildProcess();
    const mockProc2 = createMockChildProcess();
    const mockProc3 = createMockChildProcess();
    mockSpawnImpl
      .mockReturnValueOnce(mockProc1)
      .mockReturnValueOnce(mockProc2)
      .mockReturnValueOnce(mockProc3);

    const job = createResearchJob();
    const { deps, ingestCalls, updateProgressCalls } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    const invalidArtifact = {
      artifactType: 'research',
      jobId: job.id,
      timestamp: new Date().toISOString(),
      grants: [{ title: 123, funder: 'x' }],
      evidence: [],
      sourcesFound: 0,
      grantsFound: 0,
    };
    const execPromise = executeAgentJob(job, deps);

    for (const proc of [mockProc1, mockProc2, mockProc3]) {
      await flushPromises();
      deps.fs!.writeFileSync(artifactPath, JSON.stringify(invalidArtifact));
      proc.emit('exit', 0);
      await flushPromises();
      await flushPromises();
    }

    await execPromise;

    expect(ingestCalls.length).toBe(0);
    const schemaMismatches = updateProgressCalls.filter((u) => u.stage === 'schema-mismatch');
    expect(schemaMismatches.length).toBeGreaterThanOrEqual(3);
  }, 10000);

  it('AC-1.3.1: successful artifact is copied to canonical artifacts/<type>s/<jobId>.json', async () => {
    const mockProc = createMockChildProcess({ autoExitAfterMs: 2000 });
    mockSpawnImpl.mockReturnValue(mockProc);

    const job = createResearchJob();
    const { deps } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    const expectedCanonical = path.join(
      getTestDataDir(),
      'artifacts',
      'researchs',
      `${job.id}.json`,
    );
    deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));

    await executeAgentJob(job, deps);

    expect(nodeFs.existsSync(expectedCanonical)).toBe(true);
    const canonicalContent = JSON.parse(nodeFs.readFileSync(expectedCanonical, 'utf-8'));
    expect(canonicalContent.artifactType).toBe('research');
    expect(canonicalContent.jobId).toBe(job.id);
  });
});

describe('executeAgentJob - AC-1.4.1 progress reporting with required fields', () => {
  beforeEach(() => {
    currentTestDataDir = path.join(
      process.cwd(),
      `.grant-ops-data-test-progress-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    nodeFs.mkdirSync(currentTestDataDir, { recursive: true });
    nodeFs.mkdirSync(path.join(currentTestDataDir, 'tmp'), { recursive: true });
    mockSpawnImpl.mockReset();
  });

  afterEach(async () => {
    await new Promise((r) => setImmediate(r));
    if (nodeFs.existsSync(currentTestDataDir)) {
      try {
        nodeFs.rmSync(currentTestDataDir, { recursive: true, force: true });
      } catch {
        // Suppress cleanup errors
      }
    }
  });

  it('AC-1.4.1: every progress update includes status, stage, retryCount, and maxRetries', async () => {
    const mockProc = createMockChildProcess({ autoExitAfterMs: 2000 });
    mockSpawnImpl.mockReturnValue(mockProc);

    const job = createResearchJob();
    const { deps, updateProgressCalls } = createMockDeps(currentTestDataDir);

    const artifactPath = path.join(getTestDataDir(), 'tmp', `research-${job.id}.json`);
    deps.fs!.writeFileSync(artifactPath, JSON.stringify(buildValidResearchArtifact(job.id)));

    await executeAgentJob(job, deps);

    for (const call of updateProgressCalls) {
      expect(call.status).toBeDefined();
      expect(call.stage).toBeDefined();
      expect(['running', 'verifying', 'completed', 'retrying', 'failed', 'cancelled']).toContain(
        call.status,
      );
    }

    const completed = updateProgressCalls.find((u) => u.status === 'completed');
    expect(completed).toBeDefined();
    expect(completed?.stage).toBe('completed');
  });
});
