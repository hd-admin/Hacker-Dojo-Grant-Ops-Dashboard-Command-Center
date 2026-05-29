/**
 * Health Service Tests
 *
 * Tests all health check scenarios using injected mock dependencies.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrawlRun } from '../../../../shared/types';
import type { Clock, Dependencies } from './dependencies';
import {
	checkCrawler,
	checkDocumentIndexer,
	checkOpencode,
	checkStorage,
	classifyRootCause,
	compareVersions,
	getHealth,
	recordFailure,
	resolveFailure,
	getFailureHistory,
} from './health-service';
import { resolveOpencodePath } from './opencode-client';

const execFileSyncMock = vi.hoisted(() => vi.fn());
const accessMock = vi.hoisted(() => vi.fn(async () => undefined));

// Wrapper that adapts the sync mock to the callback-based execFile API
const execFileMock = vi.hoisted(() => vi.fn((_file: string, _args: string[], _opts: unknown, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
  try {
    const result = execFileSyncMock(_file, _args, _opts) as string;
    callback(null, result ?? '', '');
  } catch (err) {
    callback(err as Error, '', '');
  }
}));

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
  execFile: execFileMock,
  spawn: vi.fn(),
  default: { execFileSync: execFileSyncMock, execFile: execFileMock, spawn: vi.fn() },
}));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, default: actual, access: accessMock };
});

function createMockDeps(
	overrides: Partial<{
		repository: Record<string, ReturnType<typeof vi.fn>>;
		clock: Clock;
	}> = {},
): Dependencies {
	return {
		repository: {
			getGrants: vi.fn(),
			getOpencodeSettings: vi.fn(),
			getLatestCrawlRun: vi.fn(),
			getDocuments: vi.fn(),
			...overrides.repository,
		} as unknown as Dependencies['repository'],
		sourceService: {} as Dependencies['sourceService'],
		createOpencodeAdapter: vi.fn() as Dependencies['createOpencodeAdapter'],
		clock: overrides.clock ?? { now: () => new Date('2026-05-28T12:00:00Z') },
		idGenerator: { generateId: vi.fn(() => 'test-id') },
		persistenceRoot: { getBaseDir: vi.fn(() => '/tmp/test-data') },
		backup: {
			exportBackupSnapshot: vi.fn(),
			importBackupSnapshot: vi.fn(),
			recordBackupVerification: vi.fn(),
		} as Dependencies['backup'],
		loadBackupFreshness: vi.fn() as Dependencies['loadBackupFreshness'],
		resetPersistentStateForTests: vi.fn() as Dependencies['resetPersistentStateForTests'],
	};
}

describe('compareVersions', () => {
	it('returns 0 for equal versions', () => {
		expect(compareVersions('0.1.5', '0.1.5')).toBe(0);
	});

	it('returns positive when lhs > rhs', () => {
		expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0);
		expect(compareVersions('0.2.0', '0.1.9')).toBeGreaterThan(0);
		expect(compareVersions('0.1.6', '0.1.5')).toBeGreaterThan(0);
	});

	it('returns negative when lhs < rhs', () => {
		expect(compareVersions('0.1.4', '0.1.5')).toBeLessThan(0);
		expect(compareVersions('0.0.9', '1.0.0')).toBeLessThan(0);
	});

	it('handles different length version strings', () => {
		expect(compareVersions('1.0', '1.0.0')).toBe(0);
		expect(compareVersions('2', '1.9.9')).toBeGreaterThan(0);
	});

	it('handles non-numeric parts gracefully', () => {
		expect(compareVersions('0.1.alpha', '0.1.5')).toBeLessThan(0);
		expect(compareVersions('0.1.5', '0.1.beta')).toBeGreaterThan(0);
	});
});

describe('checkStorage', () => {
	it('returns ok when grants repository is accessible', async () => {
		const deps = createMockDeps();
		(deps.repository.getGrants as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		const result = await checkStorage(deps);
		expect(result.storage).toBe('ok');
		expect(result.storageError).toBeUndefined();
	});

	it('returns error when grants repository throws', async () => {
		const deps = createMockDeps();
		(deps.repository.getGrants as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error('storage offline'),
		);

		const result = await checkStorage(deps);
		expect(result.storage).toBe('error');
		expect(result.storageError).toContain('storage offline');
	});

	it('handles non-Error thrown values', async () => {
		const deps = createMockDeps();
		(deps.repository.getGrants as ReturnType<typeof vi.fn>).mockRejectedValue('connection refused');

		const result = await checkStorage(deps);
		expect(result.storage).toBe('error');
		expect(result.storageError).toBe('Storage unavailable');
	});
});

describe('checkOpencode', () => {
	// Default: opencode not on PATH (which throws ENOENT)
	beforeEach(() => {
		execFileSyncMock.mockReset();
		execFileSyncMock.mockImplementation(() => { throw Object.assign(new Error('ENOENT: which not found'), { code: 'ENOENT' }); });
		accessMock.mockReset();
		accessMock.mockResolvedValue(undefined);
	});

	it('returns not-installed when binaryPath is empty', async () => {
		const deps = createMockDeps();
		(deps.repository.getOpencodeSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
			binaryPath: '',
			workingDirectory: '/tmp',
			timeoutMs: 60000,
			isConfigured: false,
		});

		const result = await checkOpencode(deps);
		expect(result.opencode).toBe('not-installed');
	});

	it('returns not-installed when binaryPath is empty and opencode not on PATH', async () => {
		const deps = createMockDeps();
		(deps.repository.getOpencodeSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
			binaryPath: '',
			workingDirectory: '/tmp',
			timeoutMs: 60000,
			isConfigured: false,
		});

		const result = await checkOpencode(deps);
		expect(result.opencode).toBe('not-installed');
	});

	it('resolveOpencodePath returns null when opencode not on PATH', async () => {
		// execFileSyncMock throws ENOENT in beforeEach
		const result = await resolveOpencodePath('');
		expect(result).toBeNull();
	});

	it('resolveOpencodePath returns configured path when provided', async () => {
		const result = await resolveOpencodePath('/usr/local/bin/opencode');
		expect(result).toBe('/usr/local/bin/opencode');
	});

	it('returns not-installed when settings is null', async () => {
		const deps = createMockDeps();
		(deps.repository.getOpencodeSettings as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		const result = await checkOpencode(deps);
		expect(result.opencode).toBe('not-installed');
	});

	it('returns error when getOpencodeSettings throws', async () => {
		const deps = createMockDeps();
		(deps.repository.getOpencodeSettings as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error('database locked'),
		);

		const result = await checkOpencode(deps);
		expect(result.opencode).toBe('error');
		expect(result.opencodeError).toContain('database locked');
	});
});

describe('checkCrawler', () => {
	it('returns never-run when no crawl runs exist', async () => {
		const deps = createMockDeps();
		(deps.repository.getLatestCrawlRun as ReturnType<typeof vi.fn>).mockResolvedValue(null);

		const result = await checkCrawler(deps);
		expect(result.crawlerStatus).toBe('never-run');
		expect(result.crawlerLastRunAt).toBeUndefined();
	});

	it('returns never-run when getLatestCrawlRun throws', async () => {
		const deps = createMockDeps();
		(deps.repository.getLatestCrawlRun as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error('db-error'),
		);

		const result = await checkCrawler(deps);
		expect(result.crawlerStatus).toBe('never-run');
	});

	it('returns stale when last run is older than 7 days', async () => {
		const deps = createMockDeps({
			clock: { now: () => new Date('2026-05-28T12:00:00Z') },
		});
		const oldDate = new Date('2026-05-01T12:00:00Z').toISOString();
		const run: CrawlRun = {
			id: 'crawl-1',
			startedAt: oldDate,
			completedAt: oldDate,
			status: 'completed',
			sourcesCrawled: 5,
			grantsFound: 3,
			grantsMatched: 2,
		};
		(deps.repository.getLatestCrawlRun as ReturnType<typeof vi.fn>).mockResolvedValue(run);

		const result = await checkCrawler(deps);
		expect(result.crawlerStatus).toBe('stale');
		expect(result.crawlerLastRunAt).toBe(oldDate);
	});

	it('returns ok when last run is within 7 days', async () => {
		const deps = createMockDeps({
			clock: { now: () => new Date('2026-05-28T12:00:00Z') },
		});
		const recentDate = new Date('2026-05-27T12:00:00Z').toISOString();
		const run: CrawlRun = {
			id: 'crawl-1',
			startedAt: recentDate,
			completedAt: recentDate,
			status: 'completed',
			sourcesCrawled: 5,
			grantsFound: 3,
			grantsMatched: 2,
		};
		(deps.repository.getLatestCrawlRun as ReturnType<typeof vi.fn>).mockResolvedValue(run);

		const result = await checkCrawler(deps);
		expect(result.crawlerStatus).toBe('ok');
		expect(result.crawlerLastRunAt).toBe(recentDate);
	});

	it('uses startedAt when completedAt is not set', async () => {
		const deps = createMockDeps({
			clock: { now: () => new Date('2026-05-28T12:00:00Z') },
		});
		const recentDate = new Date('2026-05-27T12:00:00Z').toISOString();
		const run: CrawlRun = {
			id: 'crawl-1',
			startedAt: recentDate,
			status: 'running',
			sourcesCrawled: 0,
			grantsFound: 0,
			grantsMatched: 0,
		};
		(deps.repository.getLatestCrawlRun as ReturnType<typeof vi.fn>).mockResolvedValue(run);

		const result = await checkCrawler(deps);
		expect(result.crawlerStatus).toBe('ok');
		expect(result.crawlerLastRunAt).toBe(recentDate);
	});
});

describe('checkDocumentIndexer', () => {
	it('returns ok when no documents have failed extraction', async () => {
		const deps = createMockDeps();
		(deps.repository.getDocuments as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ id: 'doc-1', extractionStatus: 'extracted' },
			{ id: 'doc-2', extractionStatus: 'pending' },
		]);

		const result = await checkDocumentIndexer(deps);
		expect(result.documentIndexer).toBe('ok');
	});

	it('returns degraded when some documents failed extraction', async () => {
		const deps = createMockDeps();
		(deps.repository.getDocuments as ReturnType<typeof vi.fn>).mockResolvedValue([
			{ id: 'doc-1', extractionStatus: 'failed' },
			{ id: 'doc-2', extractionStatus: 'failed' },
			{ id: 'doc-3', extractionStatus: 'extracted' },
		]);

		const result = await checkDocumentIndexer(deps);
		expect(result.documentIndexer).toBe('degraded');
		expect(result.documentIndexerFailedCount).toBe(2);
	});

	it('returns degraded when getDocuments throws', async () => {
		const deps = createMockDeps();
		(deps.repository.getDocuments as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error('documents directory not accessible'),
		);

		const result = await checkDocumentIndexer(deps);
		expect(result.documentIndexer).toBe('degraded');
		expect(result.documentIndexerError).toContain('not accessible');
	});
});

describe('getHealth', () => {
	beforeEach(() => {
		execFileSyncMock.mockReset();
		execFileSyncMock.mockImplementation(() => { throw Object.assign(new Error('ENOENT: which not found'), { code: 'ENOENT' }); });
		accessMock.mockReset();
		accessMock.mockResolvedValue(undefined);
	});

	it('aggregates all health checks', async () => {
		const deps = createMockDeps({
			clock: { now: () => new Date('2026-05-28T12:00:00Z') },
		});
		(deps.repository.getGrants as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		(deps.repository.getOpencodeSettings as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		const recentDate = new Date('2026-05-27T12:00:00Z').toISOString();
		(deps.repository.getLatestCrawlRun as ReturnType<typeof vi.fn>).mockResolvedValue({
			id: 'crawl-1',
			startedAt: recentDate,
			completedAt: recentDate,
			status: 'completed',
			sourcesCrawled: 5,
			grantsFound: 3,
			grantsMatched: 2,
		});
		(deps.repository.getDocuments as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		const result = await getHealth(deps);
		expect(result.storage).toBe('ok');
		expect(result.opencode).toBe('not-installed');
		expect(result.crawlerStatus).toBe('ok');
		expect(result.documentIndexer).toBe('ok');
	});
});

describe('classifyRootCause', () => {
	it('classifies install-missing as binary-missing', () => {
		const result = classifyRootCause('install-missing', 'command not found: opencode');
		expect(result.category).toBe('binary-missing');
		expect(result.resolutionSteps.length).toBeGreaterThan(0);
	});

	it('classifies config-error as api-key-invalid', () => {
		const result = classifyRootCause('config-error', 'API key not set');
		expect(result.category).toBe('api-key-invalid');
		expect(result.resolutionSteps.length).toBeGreaterThan(0);
	});

	it('classifies connectivity as network-blocked', () => {
		const result = classifyRootCause('connectivity', 'ECONNREFUSED');
		expect(result.category).toBe('network-blocked');
		expect(result.resolutionSteps.length).toBeGreaterThan(0);
	});

	it('classifies capacity as provider-overloaded', () => {
		const result = classifyRootCause('capacity', '503 Service Unavailable');
		expect(result.category).toBe('provider-overloaded');
	});

	it('classifies quota-exhausted as quota-depleted', () => {
		const result = classifyRootCause('quota-exhausted', 'quota exceeded');
		expect(result.category).toBe('quota-depleted');
	});

	it('classifies interrupted-session as session-interrupted', () => {
		const result = classifyRootCause('interrupted-session', 'session terminated');
		expect(result.category).toBe('session-interrupted');
	});

	it('returns unknown for unrecognized failure modes', () => {
		const result = classifyRootCause('something-else', 'generic error');
		expect(result.category).toBe('unknown');
		expect(result.resolutionSteps.length).toBeGreaterThan(0);
	});

	it('detects disk-full from error message', () => {
		const result = classifyRootCause('unknown', 'ENOSPC: no space left on device');
		expect(result.category).toBe('disk-full');
	});

	it('detects memory-exhausted from error message', () => {
		const result = classifyRootCause('unknown', 'JavaScript heap out of memory');
		expect(result.category).toBe('memory-exhausted');
	});

	it('detects binary-incompatible', () => {
		const result = classifyRootCause('incompatible', 'version 0.0.5 but minimum 0.1.0 required');
		expect(result.category).toBe('binary-incompatible');
	});
});

describe('failure history management', () => {
	it('records and retrieves failure entries', () => {
		const idGen = { generateId: (prefix: string) => `${prefix}-test-1` };
		recordFailure('connectivity', 'Network unreachable', idGen);
		const history = getFailureHistory();
		expect(history.length).toBeGreaterThan(0);
		expect(history[0]?.failureMode).toBe('connectivity');
		expect(history[0]?.resolved).toBe(false);
		expect(history[0]?.rootCauseCategory).toBeDefined();
		expect(history[0]?.resolutionSteps?.length).toBeGreaterThan(0);
	});

	it('resolves a failure entry', () => {
		const idGen = { generateId: (prefix: string) => `${prefix}-resolve-test` };
		recordFailure('timeout', 'Operation timed out', idGen);
		const history = getFailureHistory();
		const entry = history.find((e) => e.id === 'failure-resolve-test');
		expect(entry).toBeDefined();

		const result = resolveFailure('failure-resolve-test');
		expect(result).toBe(true);

		// Check it's now resolved
		const updatedHistory = getFailureHistory();
		const updated = updatedHistory.find((e) => e.id === 'failure-resolve-test');
		expect(updated?.resolved).toBe(true);
		expect(updated?.resolvedAt).toBeDefined();
	});

	it('returns false for non-existent failure id', () => {
		expect(resolveFailure('nonexistent')).toBe(false);
	});

	it('trims history to max entries', () => {
		const MAX = 10;
		// Clear existing history by resolving all
		const current = getFailureHistory();
		for (const entry of current) {
			resolveFailure(entry.id);
		}

		for (let i = 0; i < MAX + 5; i++) {
			recordFailure('capacity', `error ${i}`, { generateId: () => `failure-bulk-${i}` });
		}
		const history = getFailureHistory();
		expect(history.length).toBeLessThanOrEqual(MAX);
		// Most recent should be first
		expect(history[0]?.id).toBe(`failure-bulk-${MAX + 4}`);
	});
});
