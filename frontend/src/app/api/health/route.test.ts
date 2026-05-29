import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import { GET } from './route';

const { getHealthMock, ensureProPublicaSourceRegisteredMock } = vi.hoisted(() => ({
	getHealthMock: vi.fn(),
	ensureProPublicaSourceRegisteredMock: vi.fn(),
}));

vi.mock('@/server/grant-ops/dependencies', () => ({
	getDependencies: () => ({}),
}));

vi.mock('@/server/grant-ops/health-service', () => ({
	getHealth: getHealthMock,
}));

vi.mock('@/server/grant-ops/propublica-service', () => ({
	ensureProPublicaSourceRegistered: ensureProPublicaSourceRegisteredMock,
}));

describe('/api/health route', () => {
	let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

	beforeEach(async () => {
		tempDataDir = await withTempDataDir();
		invalidateCache();
		getHealthMock.mockReset();
		ensureProPublicaSourceRegisteredMock.mockReset();
	});

	afterEach(async () => {
		getHealthMock.mockReset();
		ensureProPublicaSourceRegisteredMock.mockReset();
		await tempDataDir.cleanup();
		invalidateCache();
	});

	it('delegates to getHealth and returns the result', async () => {
		getHealthMock.mockResolvedValue({
			storage: 'ok',
			opencode: 'ok',
			opencodeVersion: '0.1.5',
			crawlerStatus: 'never-run',
			documentIndexer: 'ok',
		});

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

	it('returns storage error from delegated health check', async () => {
		getHealthMock.mockResolvedValue({
			storage: 'error',
			storageError: 'storage offline',
			opencode: 'not-installed',
			crawlerStatus: 'never-run',
			documentIndexer: 'ok',
		});

		const response = await GET();
		const data = (await response.json()) as {
			storage: string;
			storageError?: string;
		};

		expect(response.status).toBe(200);
		expect(data.storage).toBe('error');
		expect(data.storageError).toContain('storage offline');
	});

	it('calls ensureProPublicaSourceRegistered on every health check', async () => {
		getHealthMock.mockResolvedValue({
			storage: 'ok',
			opencode: 'ok',
			crawlerStatus: 'never-run',
			documentIndexer: 'ok',
		});
		ensureProPublicaSourceRegisteredMock.mockResolvedValue(undefined);

		await GET();

		expect(ensureProPublicaSourceRegisteredMock).toHaveBeenCalledTimes(1);
	});

	it('health response is returned even if ensureProPublicaSourceRegistered throws', async () => {
		getHealthMock.mockResolvedValue({
			storage: 'ok',
			opencode: 'ok',
			crawlerStatus: 'never-run',
			documentIndexer: 'ok',
		});
		ensureProPublicaSourceRegisteredMock.mockRejectedValue(new Error('registration failed'));

		const response = await GET();
		const data = (await response.json()) as {
			storage: string;
			opencode: string;
		};

		expect(response.status).toBe(200);
		expect(data.storage).toBe('ok');
		expect(data.opencode).toBe('ok');
	});
});
