import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import type { OpencodeSettings } from '../../../../../shared/types';
import { GET } from './route';

const { execFileSyncMock, repositoryMock } = vi.hoisted(() => ({
	execFileSyncMock: vi.fn(),
	repositoryMock: {
		getGrants: vi.fn(),
		getOpencodeSettings: vi.fn(),
		getLatestCrawlRun: vi.fn(),
		getDocuments: vi.fn(),
	},
}));

vi.mock('node:child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:child_process')>();
	return {
		...actual,
		execFileSync: execFileSyncMock,
	};
});

vi.mock('@/server/grant-ops/dependencies', () => ({
	getDependencies: () => ({
		repository: repositoryMock,
	}),
}));

describe('/api/health route', () => {
	let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
	let binaryPath: string;

	beforeEach(async () => {
		tempDataDir = await withTempDataDir();
		invalidateCache();
		binaryPath = path.join(tempDataDir.dataDir, 'opencode-health-stub.sh');
		await fs.writeFile(binaryPath, '#!/bin/sh\necho 0.1.5\n', 'utf8');
		await fs.chmod(binaryPath, 0o755);
		await fs.mkdir(path.join(tempDataDir.dataDir, 'documents'), { recursive: true });
		repositoryMock.getGrants.mockReset();
		repositoryMock.getOpencodeSettings.mockReset();
		repositoryMock.getLatestCrawlRun.mockReset();
		repositoryMock.getDocuments.mockReset();
		repositoryMock.getGrants.mockResolvedValue([]);
		repositoryMock.getOpencodeSettings.mockResolvedValue({
			binaryPath,
			workingDirectory: tempDataDir.dataDir,
			timeoutMs: 60000,
			profile: 'default',
			isConfigured: true,
		} as OpencodeSettings);
		repositoryMock.getLatestCrawlRun.mockResolvedValue(null);
		repositoryMock.getDocuments.mockResolvedValue([]);
		execFileSyncMock.mockReset();
		execFileSyncMock.mockReturnValue('0.1.5\n');
	});

	afterEach(async () => {
		execFileSyncMock.mockReset();
		repositoryMock.getGrants.mockReset();
		repositoryMock.getOpencodeSettings.mockReset();
		repositoryMock.getLatestCrawlRun.mockReset();
		repositoryMock.getDocuments.mockReset();
		await tempDataDir.cleanup();
		invalidateCache();
	});

	it('reports healthy storage, opencode, crawler, and document indexer state', async () => {
		const response = await GET();
		const data = (await response.json()) as {
			storage: string;
			opencode: string;
			opencodeVersion?: string;
			crawlerStatus: string;
			documentIndexer: string;
		};

		expect(response.status).toBe(200);
		expect(data.storage).toBe('ok');
		expect(data.opencode).toBe('ok');
		expect(data.opencodeVersion).toBe('0.1.5');
		expect(data.crawlerStatus).toBe('never-run');
		expect(data.documentIndexer).toBe('ok');
	});

	it('marks storage error when the grants repository is unavailable', async () => {
		repositoryMock.getGrants.mockRejectedValueOnce(new Error('storage offline'));

		const response = await GET();
		const data = (await response.json()) as {
			storage: string;
			storageError?: string;
		};

		expect(response.status).toBe(200);
		expect(data.storage).toBe('error');
		expect(data.storageError).toContain('storage offline');
	});
});
