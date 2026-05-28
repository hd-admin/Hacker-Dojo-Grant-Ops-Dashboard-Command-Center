/**
 * Health Service Tests
 *
 * Tests all health check scenarios using injected mock dependencies.
 */

import { describe, expect, it, vi } from 'vitest';
import type { CrawlRun } from '../../../../shared/types';
import type { Clock, Dependencies } from './dependencies';
import {
	checkCrawler,
	checkDocumentIndexer,
	checkOpencode,
	checkStorage,
	compareVersions,
	getHealth,
} from './health-service';

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
		expect(result.opencodeError).toContain('Failed to check opencode');
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
