/**
 * Health Service
 *
 * Shared health-check logic used by both the health and diagnostics API routes.
 * All functions accept Dependencies for testability.
 */

import type { FailureHistoryEntry, FailureRootCauseCategory, HealthCheckResult } from '../../../../shared/types';
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

// Maximum failure history entries to retain
const MAX_FAILURE_HISTORY = 10;

// In-memory failure history store (persisted across requests but lost on restart)
const failureHistory: FailureHistoryEntry[] = [];

/**
 * Classify a failure message into a root-cause category for operator guidance.
 */
export function classifyRootCause(
	failureMode: string,
	errorMessage: string,
): { category: FailureRootCauseCategory; resolutionSteps: string[] } {
	const lower = errorMessage.toLowerCase();

	// Binary missing
	if (failureMode === 'install-missing' || /command not found|no such file|enoent|not installed/i.test(lower)) {
		return {
			category: 'binary-missing',
			resolutionSteps: [
				'Verify opencode is installed: run `which opencode` or `opencode --version`',
				'Check the binary path in Settings → Opencode Status is correct',
				'Install opencode from https://opencode.ai if not present',
			],
		};
	}

	// Binary incompatible
	if (failureMode === 'incompatible' || /version.*incompatible|minimum.*required/i.test(lower)) {
		return {
			category: 'binary-incompatible',
			resolutionSteps: [
				'Run `opencode --version` to check your installed version',
				'Update opencode to the latest version',
				'Check the application minimum version requirement in Settings',
			],
		};
	}

	// API key invalid
	if (failureMode === 'config-error' || /api.key|unauthorized|authentication/i.test(lower)) {
		return {
			category: 'api-key-invalid',
			resolutionSteps: [
				'Verify your API key in opencode configuration',
				'Check that the profile is properly configured',
				'Regenerate API keys if they have been revoked',
			],
		};
	}

	// Network blocked
	if (failureMode === 'connectivity' || /network.*unreachable|connection refused|econnrefused|enotfound|dns.*resolve/i.test(lower)) {
		return {
			category: 'network-blocked',
			resolutionSteps: [
				'Check your internet connection',
				'Verify firewall/proxy settings allow outbound connections',
				'If behind a corporate network, check VPN/proxy configuration',
				'Try accessing the provider endpoint directly to verify connectivity',
			],
		};
	}

	// Provider overloaded
	if (failureMode === 'capacity' || failureMode === 'rate-limit' || /503|service unavailable|overloaded|busy/i.test(lower)) {
		return {
			category: 'provider-overloaded',
			resolutionSteps: [
				'Wait 1-5 minutes and retry the operation',
				'Check the provider status page for ongoing incidents',
				'Consider switching to a different provider if available',
			],
		};
	}

	// Quota depleted
	if (failureMode === 'quota-exhausted' || /quota exceeded|quota exhausted|billing.*limit/i.test(lower)) {
		return {
			category: 'quota-depleted',
			resolutionSteps: [
				'Check your current quota usage and billing status',
				'Upgrade your plan or purchase additional quota',
				'Wait for the next billing cycle if quota resets automatically',
			],
		};
	}

	// Session interrupted
	if (failureMode === 'interrupted-session' || failureMode === 'partial-output' || /session.*terminat|connection.*closed|stream.*interrupted/i.test(lower)) {
		return {
			category: 'session-interrupted',
			resolutionSteps: [
				'Check job details for partial output that may be recoverable',
				'Retry the operation — interrupted sessions often succeed on retry',
				'If persistent, reduce the scope or complexity of the request',
			],
		};
	}

	// Disk full
	if (/disk.*full|no space|enospc/i.test(lower)) {
		return {
			category: 'disk-full',
			resolutionSteps: [
				'Free up disk space on the machine running opencode',
				'Check available disk space with `df -h`',
				'Clear temporary files and caches',
			],
		};
	}

	// Memory exhausted
	if (/memory|out of memory|oom/i.test(lower)) {
		return {
			category: 'memory-exhausted',
			resolutionSteps: [
				'Reduce the scope of the request (fewer sources, smaller context)',
				'Close other applications to free memory',
				'Consider increasing system memory if this occurs frequently',
			],
		};
	}

	return {
		category: 'unknown',
		resolutionSteps: [
			'Review the full error message for clues',
			'Check application logs for additional context',
			'Try restarting the application',
			'Contact support with the error details',
		],
	};
}

/**
 * Record a failure event in the history log.
 * Automatically trims history to MAX_FAILURE_HISTORY entries.
 */
export function recordFailure(
	failureMode: string,
	errorMessage: string,
	idGenerator: { generateId: (prefix: string) => string },
): void {
	const { category, resolutionSteps } = classifyRootCause(failureMode, errorMessage);
	const entry: FailureHistoryEntry = {
		id: idGenerator.generateId('failure'),
		timestamp: new Date().toISOString(),
		failureMode,
		errorMessage,
		resolved: false,
		rootCauseCategory: category,
		resolutionSteps,
	};

	failureHistory.unshift(entry);

	// Trim to max entries
	while (failureHistory.length > MAX_FAILURE_HISTORY) {
		failureHistory.pop();
	}
}

/**
 * Mark a failure history entry as resolved.
 */
export function resolveFailure(failureId: string): boolean {
	const entry = failureHistory.find((e) => e.id === failureId);
	if (!entry) return false;
	entry.resolved = true;
	entry.resolvedAt = new Date().toISOString();
	return true;
}

/**
 * Get the current failure history (most recent first).
 */
export function getFailureHistory(): FailureHistoryEntry[] {
	return [...failureHistory];
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

	return {
		...storage,
		...opencode,
		...crawler,
		...documentIndexer,
		failureHistory: getFailureHistory(),
	};
}
