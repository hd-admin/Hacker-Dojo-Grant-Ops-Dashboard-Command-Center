import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NextResponse } from 'next/server';
import { getDataDir } from '../../../../../shared/grant-ops-persistence';
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { HealthCheckResult } from '../../../../../shared/types';

export const dynamic = 'force-dynamic';
const MIN_OPENCODE_VERSION = '0.1.0';

function compareVersions(left: string, right: string): number {
	const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
	const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
	for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
		const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

export async function GET() {
	const deps = getDependencies();
	const result: HealthCheckResult = {
		storage: 'ok',
		opencode: 'not-installed',
		crawlerStatus: 'never-run',
		documentIndexer: 'ok',
	};

	try {
		await deps.repository.getGrants();
	} catch (error) {
		result.storage = 'error';
		result.storageError = error instanceof Error ? error.message : 'Storage unavailable';
	}

	try {
		const settings = await deps.repository.getOpencodeSettings();
		const binaryPath = settings?.binaryPath?.trim() ?? '';
		if (!binaryPath) {
			result.opencode = 'not-installed';
		} else {
			try {
				await fs.access(binaryPath);
				const output = execFileSync(binaryPath, ['--version'], { encoding: 'utf8', timeout: 3000 });
				const versionMatch = /(?:(\d+)\.(\d+)\.(\d+))/u.exec(output);
				if (!versionMatch) {
					result.opencode = 'error';
					result.opencodeError = 'Unable to determine opencode version';
				} else {
					const version = versionMatch[0];
					result.opencodeVersion = version;
					if (compareVersions(version, MIN_OPENCODE_VERSION) < 0) {
						result.opencode = 'incompatible';
						result.opencodeError = `Version ${version} found but minimum ${MIN_OPENCODE_VERSION} required.`;
					} else {
						result.opencode = 'ok';
					}
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unable to reach opencode';
				if (message.toLowerCase().includes('no such file') || message.toLowerCase().includes('enoent')) {
					result.opencode = 'not-installed';
					result.opencodeError = 'Binary not found at configured path';
				} else if (message.toLowerCase().includes('eacces') || message.toLowerCase().includes('timed out')) {
					result.opencode = 'not-reachable';
					result.opencodeError = message;
				} else {
					result.opencode = 'error';
					result.opencodeError = message;
				}
			}
		}
	} catch (error) {
		result.opencode = 'error';
		result.opencodeError = error instanceof Error ? error.message : 'Failed to check opencode';
	}

	try {
		const latestRun = await deps.repository.getLatestCrawlRun();
		if (!latestRun) {
			result.crawlerStatus = 'never-run';
		} else {
			result.crawlerLastRunAt = latestRun.completedAt ?? latestRun.startedAt;
			const ageMs = Date.now() - new Date(result.crawlerLastRunAt).getTime();
			result.crawlerStatus = ageMs > 7 * 24 * 60 * 60 * 1000 ? 'stale' : 'ok';
		}
	} catch {
		result.crawlerStatus = 'never-run';
	}

	try {
		await fs.access(path.join(getDataDir(), 'documents'));
		const documents = await deps.repository.getDocuments();
		const failedCount = documents.filter((document) => document.extractionStatus === 'failed').length;
		if (failedCount > 0) {
			result.documentIndexer = 'degraded';
			result.documentIndexerFailedCount = failedCount;
		} else {
			result.documentIndexer = 'ok';
		}
	} catch (error) {
		result.documentIndexer = 'degraded';
		result.documentIndexerError = error instanceof Error ? error.message : 'Documents directory not accessible';
	}

	return NextResponse.json(result);
}
