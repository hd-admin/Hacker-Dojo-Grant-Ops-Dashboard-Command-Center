/**
 * Health Service
 *
 * Shared health-check logic used by both the health and diagnostics API routes.
 * All functions accept Dependencies for testability.
 */

import type { HealthCheckResult } from '../../../../shared/types';
import type { Dependencies } from './dependencies';

const MIN_OPENCODE_VERSION = '0.1.0';
const CRAWL_STALENESS_MS = 7 * 24 * 60 * 60 * 1000;

export function compareVersions(left: string, right: string): number {
	const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
	const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
	for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
		const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

export async function checkStorage(deps: Dependencies): Promise<
	Pick<HealthCheckResult, 'storage' | 'storageError'>
> {
	try {
		await deps.repository.getGrants();
		return { storage: 'ok' };
	} catch (error) {
		return {
			storage: 'error',
			storageError: error instanceof Error ? error.message : 'Storage unavailable',
		};
	}
}

export async function checkOpencode(deps: Dependencies): Promise<
	Pick<HealthCheckResult, 'opencode' | 'opencodeError' | 'opencodeVersion'>
> {
	try {
		const settings = await deps.repository.getOpencodeSettings();
		const binaryPath = settings?.binaryPath?.trim() ?? '';
		if (!binaryPath) {
			return { opencode: 'not-installed' };
		}

		const { execFileSync } = await import('node:child_process');
		const { access } = await import('node:fs/promises');

		try {
			await access(binaryPath);
			const output = execFileSync(binaryPath, ['--version'], {
				encoding: 'utf8',
				timeout: 3000,
			});
			const versionMatch = /(?:(\d+)\.(\d+)\.(\d+))/u.exec(output);
			if (!versionMatch) {
				return {
					opencode: 'error',
					opencodeError: 'Unable to determine opencode version',
				};
			}

			const version = versionMatch[0];
			if (compareVersions(version, MIN_OPENCODE_VERSION) < 0) {
				return {
					opencode: 'incompatible',
					opencodeError: `Version ${version} found but minimum ${MIN_OPENCODE_VERSION} required.`,
					opencodeVersion: version,
				};
			}

			return { opencode: 'ok', opencodeVersion: version };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unable to reach opencode';
			if (message.toLowerCase().includes('no such file') || message.toLowerCase().includes('enoent')) {
				return {
					opencode: 'not-installed',
					opencodeError: 'Binary not found at configured path',
				};
			}
			if (message.toLowerCase().includes('eacces') || message.toLowerCase().includes('timed out')) {
				return {
					opencode: 'not-reachable',
					opencodeError: message,
				};
			}
			return { opencode: 'error', opencodeError: message };
		}
	} catch (error) {
		return {
			opencode: 'error',
			opencodeError: error instanceof Error ? error.message : 'Failed to check opencode',
		};
	}
}

export async function checkCrawler(deps: Dependencies): Promise<
	Pick<HealthCheckResult, 'crawlerStatus' | 'crawlerLastRunAt'>
> {
	try {
		const latestRun = await deps.repository.getLatestCrawlRun();
		if (!latestRun) {
			return { crawlerStatus: 'never-run' };
		}

		const lastRunAt = latestRun.completedAt ?? latestRun.startedAt;
		const ageMs = deps.clock.now().getTime() - new Date(lastRunAt).getTime();
		return {
			crawlerStatus: ageMs > CRAWL_STALENESS_MS ? 'stale' : 'ok',
			crawlerLastRunAt: lastRunAt,
		};
	} catch {
		return { crawlerStatus: 'never-run' };
	}
}

export async function checkDocumentIndexer(deps: Dependencies): Promise<
	Pick<HealthCheckResult, 'documentIndexer' | 'documentIndexerError' | 'documentIndexerFailedCount'>
> {
	try {
		const documents = await deps.repository.getDocuments();
		const failedCount = documents.filter(
			(document) => document.extractionStatus === 'failed',
		).length;
		if (failedCount > 0) {
			return { documentIndexer: 'degraded', documentIndexerFailedCount: failedCount };
		}
		return { documentIndexer: 'ok' };
	} catch (error) {
		return {
			documentIndexer: 'degraded',
			documentIndexerError:
				error instanceof Error ? error.message : 'Documents directory not accessible',
		};
	}
}

/**
 * Run all health checks and return a complete HealthCheckResult.
 */
export async function getHealth(deps: Dependencies): Promise<HealthCheckResult> {
	const [storage, opencode, crawler, documentIndexer] = await Promise.all([
		checkStorage(deps),
		checkOpencode(deps),
		checkCrawler(deps),
		checkDocumentIndexer(deps),
	]);

	return { ...storage, ...opencode, ...crawler, ...documentIndexer };
}
