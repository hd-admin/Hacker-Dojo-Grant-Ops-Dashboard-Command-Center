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
const HANDSHAKE_TIMEOUT_MS = 10_000;
const HANDSHAKE_DEGRADED_THRESHOLD_MS = 5_000;

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

function classifyHandshakeError(message: string, output?: string): string {
	const lower = message.toLowerCase();

	// Binary not responding: timeout or no output
	if (
		/timed out|timeout|deadline exceeded/i.test(lower) ||
		(output !== undefined && output.trim().length === 0)
	) {
		return 'Binary found but not responding: timeout or empty output';
	}

	// Binary responding but incompatible: output lacks expected CLI structure
	if (
		output !== undefined &&
		!/\b(?:usage|options?|commands?|help|flags?|arguments?)\b/i.test(output)
	) {
		return 'Binary responding but incompatible: output missing expected CLI structure';
	}

	// Binary responding but returning malformed output: output has issues
	if (
		output !== undefined &&
		(/error|exception|fail|invalid|unrecognized/i.test(output) || output.length < 20)
	) {
		return 'Binary responding but returning malformed output';
	}

	if (/eacces|permission denied/i.test(lower)) {
		return 'Binary found but not responding: permission denied';
	}

	if (/enoent|no such file|command not found|not installed/i.test(lower)) {
		return 'Binary not found at configured path';
	}

	return `Handshake failed: ${message}`;
}

function extractCapabilities(output: string): string[] {
	const capabilities: string[] = [];

	// Detect CLI structure markers
	if (/\b(?:--help|-h)\b/.test(output)) capabilities.push('help-flag');
	if (/\b(?:--version|-V)\b/.test(output)) capabilities.push('version-flag');
	if (/\b(?:--model|--provider)\b/i.test(output)) capabilities.push('model-selection');
	if (/\b(?:--profile|--config)\b/i.test(output)) capabilities.push('profile-support');
	if (/\b(?:--prompt|--message|--input)\b/i.test(output)) capabilities.push('prompt-input');
	if (/\b(?:--output|-o)\b/.test(output)) capabilities.push('output-flag');
	if (/\b(?:--timeout)\b/i.test(output)) capabilities.push('timeout-support');
	if (/\brun\b/.test(output)) capabilities.push('run-subcommand');

	return capabilities;
}

async function performHandshake(
	binaryPath: string,
	deps: Dependencies,
): Promise<
	Pick<HealthCheckResult, 'handshakeSuccess' | 'handshakeResponseTimeMs' | 'handshakeError' | 'capabilities'>
> {
	const startTime = deps.clock.now().getTime();

	try {
		const { execFileSync } = await import('node:child_process');
		const output = execFileSync(binaryPath, ['run', '--help'], {
			encoding: 'utf8',
			timeout: HANDSHAKE_TIMEOUT_MS,
			maxBuffer: 1024 * 1024,
		});

		const responseTimeMs = deps.clock.now().getTime() - startTime;

		// Validate output is non-empty
		if (!output || output.trim().length === 0) {
			return {
				handshakeSuccess: false,
				handshakeResponseTimeMs: responseTimeMs,
				handshakeError: 'Binary found but not responding: empty output',
			};
		}

		// Validate output has recognizable CLI structure
		if (!/\b(?:usage|options?|commands?|help|flags?|arguments?|opencode)\b/i.test(output)) {
			return {
				handshakeSuccess: false,
				handshakeResponseTimeMs: responseTimeMs,
				handshakeError: 'Binary responding but incompatible: output missing expected CLI structure',
				capabilities: extractCapabilities(output),
			};
		}

		// Flag degraded performance
		if (responseTimeMs > HANDSHAKE_DEGRADED_THRESHOLD_MS) {
			return {
				handshakeSuccess: true,
				handshakeResponseTimeMs: responseTimeMs,
				handshakeError: `Response time degraded: ${responseTimeMs}ms exceeds ${HANDSHAKE_DEGRADED_THRESHOLD_MS}ms threshold`,
				capabilities: extractCapabilities(output),
			};
		}

		return {
			handshakeSuccess: true,
			handshakeResponseTimeMs: responseTimeMs,
			capabilities: extractCapabilities(output),
		};
	} catch (error) {
		const responseTimeMs = deps.clock.now().getTime() - startTime;
		const message = error instanceof Error ? error.message : 'Unknown handshake error';

		return {
			handshakeSuccess: false,
			handshakeResponseTimeMs: responseTimeMs,
			handshakeError: classifyHandshakeError(message),
		};
	}
}

export async function checkOpencode(deps: Dependencies): Promise<
	Pick<HealthCheckResult, 'opencode' | 'opencodeError' | 'opencodeVersion' | 'handshakeSuccess' | 'handshakeResponseTimeMs' | 'handshakeError' | 'capabilities'>
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
				const handshake = await performHandshake(binaryPath, deps);
				return {
					opencode: 'error',
					opencodeError: 'Unable to determine opencode version',
					...handshake,
				};
			}

			const version = versionMatch[0];
			if (compareVersions(version, MIN_OPENCODE_VERSION) < 0) {
				const handshake = await performHandshake(binaryPath, deps);
				return {
					opencode: 'incompatible',
					opencodeError: `Version ${version} found but minimum ${MIN_OPENCODE_VERSION} required.`,
					opencodeVersion: version,
					...handshake,
				};
			}

			const handshake = await performHandshake(binaryPath, deps);
			return { opencode: 'ok', opencodeVersion: version, ...handshake };
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
