/**
 * Opencode Client Adapter
 *
 * This module provides a typed adapter for the Opencode CLI tool.
 * It shells out to the configured Opencode binary with appropriate arguments,
 * timeout, and working directory settings.
 *
 * Production path: executes the Opencode CLI with provided arguments
 * Test path: uses a fake provider for deterministic testing
 */

import { spawn } from "node:child_process";
import type { OpencodeSettings } from "../../../../shared/types";

export interface OpencodeRequest {
	prompt: string;
	systemPrompt?: string;
	temperature?: number;
	maxTokens?: number;
}

export interface GroundingSection {
	sectionTitle: string;
	evidence: string[];
	isGrounded: boolean;
}

export interface OpencodeResponse {
	success: boolean;
	content?: string;
	error?: string;
	exitCode?: number;
	failureMode?: OpencodeFailureMode;
	/**
	 * Section-level grounding metadata provided by opencode.
	 * When absent, groundingSections should fall back to empty array - never fabricate.
	 */
	groundingSections?: GroundingSection[];
}

export interface GrantResearchRequest {
	organizationProfile: string;
	searchThemes: string[];
	sourceName?: string;
	sourceUrl?: string;
}

export interface DraftGenerationRequest {
	grantTitle: string;
	grantFunder: string;
	grantAmount?: string;
	grantDeadline?: string;
	organizationProfile: string;
	missionStatement: string;
	previousDraft?: string;
	revisionNotes?: string;
	groundingDocuments?: string[];
}

export type OpencodeFailureMode =
	| 'install-missing'
	| 'config-error'
	| 'rate-limit'
	| 'malformed-output'
	| 'context-overflow'
	| 'partial-output'
	| 'model-unavailable'
	| 'timeout'
	| 'connectivity'
	| 'quota-exhausted'
	| 'capacity'
	| 'interrupted-session'
	| 'unknown';

export type OpencodeProvider = "cli" | "fake";

/**
 * Classify an opencode execution error into a standard failure mode.
 * Uses stderr content, error message, and exit code to infer the root cause.
 */
export function classifyOpencodeError(
	errorMessage: string,
	stderr?: string,
	exitCode?: number,
): OpencodeFailureMode {
	const combined = [errorMessage, stderr].filter(Boolean).join(' ').toLowerCase();

	// Install-missing: binary not found on PATH or at configured path
	if (/command not found|no such file|enoent|not installed/i.test(combined)) {
		return 'install-missing';
	}

	// Config-error: API key missing, profile not found, permission denied
	if (/api.key|unauthorized|authentication|permission denied|eacces|not configured|profile.*not found/i.test(combined)) {
		return 'config-error';
	}

	// Quota-exhausted: explicit quota exceeded (separate from rate-limit throttling)
	if (/quota exceeded|quota exhausted|billing.*limit|usage limit reached/i.test(combined)) {
		return 'quota-exhausted';
	}

	// Rate-limit: provider throttling (transient, not quota)
	if (/429|rate.limit|too many requests|rate exceeded/i.test(combined)) {
		return 'rate-limit';
	}

	// Malformed-output: unparseable response, invalid JSON, unexpected format
	if (/unexpected token|syntax.?error|malformed|invalid json|parse error|unexpected.*format/i.test(combined)) {
		return 'malformed-output';
	}

	// Context-overflow: token limit, context window exceeded
	if (/context length|token limit|maximum context|context.*exceed|too long/i.test(combined)) {
		return 'context-overflow';
	}

	// Interrupted-session: session terminated, connection closed mid-stream
	if (/session.*terminat|connection.*closed|stream.*interrupted|hang.?up|sigpipe/i.test(combined) || exitCode === 141) {
		return 'interrupted-session';
	}

	// Partial-output: output truncated, cut off, incomplete response
	if (/truncated|incomplete|partial|cut off|broken pipe/i.test(combined)) {
		return 'partial-output';
	}

	// Capacity: resource exhausted, busy, 503 service unavailable
	if (/resource exhausted|busy|503|service unavailable|overloaded/i.test(combined)) {
		return 'capacity';
	}

	// Model-unavailable: model not found or temporarily unavailable
	if (/model.*not found|model.*unavailable/i.test(combined)) {
		return 'model-unavailable';
	}

	// Timeout: execution exceeded deadline
	if (/timed out|timeout|deadline exceeded/i.test(combined) || exitCode === 124) {
		return 'timeout';
	}

	// Connectivity: network unreachable, connection refused (not binary-not-found)
	if (/network.*unreachable|connection refused|econnrefused|enotfound|dns.*resolve/i.test(combined)) {
		return 'connectivity';
	}

	return 'unknown';
}

export interface OpencodeAdapter {
	executeResearch(request: GrantResearchRequest): Promise<OpencodeResponse>;
	generateDraft(request: DraftGenerationRequest): Promise<OpencodeResponse>;
	isConfigured(): boolean;
}

export function normalizeOpencodeOutput(stdout: string): string {
	const trimmed = stdout.trim();
	if (!trimmed) {
		return '';
	}

	const chunks: string[] = [];
	const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	let parsedAny = false;

	for (const line of lines) {
		try {
			const event = JSON.parse(line) as {
				type?: string;
				part?: { text?: unknown };
			};
			parsedAny = true;
			if (event.type === 'text' && typeof event.part?.text === 'string') {
				chunks.push(event.part.text);
			}
		} catch {
			return trimmed;
		}
	}

	if (!parsedAny || chunks.length === 0) {
		return trimmed;
	}

	return chunks.join('\n').trim();
}

class FakeOpencodeProvider implements OpencodeAdapter {
	private shouldFail = false;

	setShouldFail(fail: boolean): void {
		this.shouldFail = fail;
	}

	async executeResearch(
		request: GrantResearchRequest,
	): Promise<OpencodeResponse> {
		if (this.shouldFail) {
			return {
				success: false,
				error: "Fake provider: Opencode binary not found",
				exitCode: 1,
			};
		}

		// Return deterministic mock research data
		const mockResearch = {
			grants: [
				{
					id: `mock-grant-001`,
					title: `${request.searchThemes[0] || 'Technology'} Community Grant`,
					funder: 'Mock Foundation',
					funderShort: 'Mock',
					award: '$50,000',
					awardSort: 50000,
					deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
						.toISOString()
						.split('T')[0],
					daysOut: 30,
					fit: 82,
					tags: ['Community', 'Technology'],
					status: 'matched' as const,
					statusLabel: 'Matched',
					matchedAt: new Date().toISOString(),
				},
				{
					id: `mock-grant-002`,
					title: `${request.searchThemes[1] || request.searchThemes[0] || 'Education'} Innovation Grant`,
					funder: 'Alliance for Learning',
					funderShort: 'Alliance',
					award: '$75,000',
					awardSort: 75000,
					deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
						.toISOString()
						.split('T')[0],
					daysOut: 45,
					fit: 76,
					tags: ['Education', 'Innovation'],
					status: 'matched' as const,
					statusLabel: 'Matched',
					matchedAt: new Date().toISOString(),
				},
				{
					id: `mock-grant-003`,
					title: `${request.searchThemes[2] || request.searchThemes[0] || 'Community'} Capacity Grant`,
					funder: 'Community Innovation Network',
					funderShort: 'CIN',
					award: '$25,000',
					awardSort: 25000,
					deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
						.toISOString()
						.split('T')[0],
					daysOut: 60,
					fit: 71,
					tags: ['Community', 'Capacity'],
					status: 'matched' as const,
					statusLabel: 'Matched',
					matchedAt: new Date().toISOString(),
				},
			],
			evidence: [
				{
					id: 'evidence-001',
					grantId: 'mock-grant-001',
					sourceId: 'mock-source-001',
					sourceName: request.sourceName || 'Mock Source',
					evidenceType: 'eligibility' as const,
					content: `${request.searchThemes[0] || 'Technology'} alignment and community impact fit the funder priorities.`,
					capturedAt: new Date().toISOString(),
				},
			],
			rationale: 'Mock research completed successfully across multiple aligned grants',
		};

		return {
			success: true,
			content: JSON.stringify(mockResearch),
		};
	}

	async generateDraft(
		request: DraftGenerationRequest,
	): Promise<OpencodeResponse> {
		if (this.shouldFail) {
			return {
				success: false,
				error: "Fake provider: Opencode binary not found",
				exitCode: 1,
			};
		}

		const groundingSection = request.groundingDocuments?.length
			? `\n\nGrounding Documents:\n${request.groundingDocuments.join("\n\n")}`
			: "";

		const mockDraft = `## ${request.grantTitle}

### Executive Summary

${request.organizationProfile} is seeking funding to support our mission of ${request.missionStatement}.${groundingSection}

### Program Description

This proposal outlines a comprehensive approach to addressing key community needs through innovative programs and partnerships.

### Organizational Qualifications

Our organization brings extensive experience in delivering impactful services to the community.

### Budget Overview

[Budget details to be added based on grant requirements]

### Conclusion

We believe this partnership will create lasting positive impact in our community.
`;

		return {
			success: true,
			content: mockDraft,
		};
	}

	isConfigured(): boolean {
		return !this.shouldFail;
	}
}

class CliOpencodeProvider implements OpencodeAdapter {
	private settings: OpencodeSettings;

	constructor(settings: OpencodeSettings) {
		this.settings = settings;
	}

	updateSettings(settings: OpencodeSettings): void {
		this.settings = settings;
	}

	private async runCommand(args: string[]): Promise<OpencodeResponse> {
		return new Promise((resolve) => {
			const binaryPath = this.settings.binaryPath || "opencode";
			const timeoutMs = this.settings.timeoutMs || 60000;

			const proc = spawn(binaryPath, args, {
				cwd: this.settings.workingDirectory || process.cwd(),
				stdio: ['ignore', 'pipe', 'pipe'],
			});

			let stdout = "";
			let stderr = "";
			let settled = false;
			let timeoutHandle: NodeJS.Timeout | null = null;
			let killTimeoutHandle: NodeJS.Timeout | null = null;

			const settle = (response: OpencodeResponse): void => {
				if (settled) {
					return;
				}
				settled = true;
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
					timeoutHandle = null;
				}
				if (killTimeoutHandle) {
					clearTimeout(killTimeoutHandle);
					killTimeoutHandle = null;
				}
				resolve(response);
			};

			proc.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			proc.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			proc.on("close", (code) => {
				if (code === 0) {
					settle({
						success: true,
						content: normalizeOpencodeOutput(stdout),
						exitCode: code ?? 0,
					});
				} else {
					const errorMessage = stderr.trim() || `Opencode exited with code ${code}`;
					const exitCode = code ?? 1;
					const failureMode = classifyOpencodeError(errorMessage, stderr, exitCode);
					const partialContent = stdout.trim() || undefined;
					settle({
						success: false,
						content: partialContent,
						error: errorMessage,
						exitCode: exitCode,
						failureMode,
					});
				}
			});

			proc.on("error", (err) => {
				const errorMessage = `Failed to execute Opencode: ${err.message}`;
				settle({
					success: false,
					error: errorMessage,
					exitCode: 1,
					failureMode: classifyOpencodeError(errorMessage),
				});
			});

			timeoutHandle = setTimeout(() => {
				if (!settled) {
					proc.kill('SIGTERM');
					// Set up a harder kill timeout if process doesn't respond
					killTimeoutHandle = setTimeout(() => {
						if (!settled && proc.exitCode === null) {
							proc.kill('SIGKILL');
						}
					}, 5000);
					const partialContent = stdout.trim() || undefined;
					settle({
						success: false,
						content: partialContent,
						error: `Opencode timed out after ${timeoutMs}ms`,
						exitCode: 124,
						failureMode: "timeout",
					});
				}
			}, timeoutMs)
		});
	}

	async executeResearch(
		request: GrantResearchRequest,
	): Promise<OpencodeResponse> {
		if (!this.isConfigured()) {
			return {
				success: false,
				error:
					"Opencode not configured. Please set binary path and working directory in settings.",
				exitCode: 1,
			};
		}

		const prompt = `Return only JSON.
Find 1-3 real grant opportunities for Hacker Dojo using the request context below.
Use the current source URL and the listed themes to return source-backed grants that fit educational technology nonprofits, community innovation, or science/technology funding.
Do not invent placeholder or "plausible" grants.
Return a JSON object with grants, evidence, and rationale.

Organization profile:
${request.organizationProfile}

Search themes:
${request.searchThemes.join(', ')}
${request.sourceName ? `
Source name: ${request.sourceName}` : ''}
${request.sourceUrl ? `
Source URL: ${request.sourceUrl}` : ''}`;

		const args = [
			"run",
			"--format",
			"json",
			prompt,
		];

		return this.runCommand(args);
	}

	async generateDraft(
		request: DraftGenerationRequest,
	): Promise<OpencodeResponse> {
		if (!this.isConfigured()) {
			return {
				success: false,
				error:
					"Opencode not configured. Please set binary path and working directory in settings.",
				exitCode: 1,
			};
		}

		let prompt = `Write a concise grant proposal in Markdown for ${request.grantTitle}. Use these sections: Executive Summary, Program Design, Qualifications, Budget, Closing. Keep it under 350 words and include no preamble.

Grant: ${request.grantTitle}
Funder: ${request.grantFunder}
${request.grantAmount ? `Award Amount: ${request.grantAmount}` : ""}
${request.grantDeadline ? `Deadline: ${request.grantDeadline}` : ""}

Organization:
${request.organizationProfile}

Mission:
${request.missionStatement}
`;

		if (request.groundingDocuments?.length) {
			prompt += `\n\nGrounding documents:\n${request.groundingDocuments.join("\n\n")}`;
		}

		if (request.previousDraft) {
			prompt += `\n\nPrevious Draft:\n${request.previousDraft}`;
			prompt += `\n\nRevision Notes:\n${request.revisionNotes || "Please improve the draft based on feedback."}`;
		}

		const args = [
			"run",
			prompt,
		];

		return this.runCommand(args);
	}

	isConfigured(): boolean {
		return this.settings.isConfigured && !!this.settings.binaryPath;
	}
}

// Factory function to create the appropriate provider
// NOTE: 'fake' provider is test-only. In production, only 'cli' is allowed.
// Attempts to use 'fake' in non-test environments will throw an error.
export function createOpencodeAdapter(
	settings: OpencodeSettings,
	providerType: OpencodeProvider = "cli",
): OpencodeAdapter {
	if (providerType === "fake") {
		// 'fake' provider is test-only — reject in production to prevent
		// synthetic data from masquerading as real grant/research output
		const env = process.env.NODE_ENV ?? "";
		const isTestEnv = env === "test";
		if (!isTestEnv) {
			throw new Error(
				"InvalidOperation: 'fake' opencode provider is test-only and cannot be used in " +
				`current environment (NODE_ENV=${env}). ` +
				"If opencode is not configured, the application will return explicit errors " +
				"rather than synthetic data. Configure opencode settings or use the CLI provider.",
			);
		}
		return new FakeOpencodeProvider();
	}
	return new CliOpencodeProvider(settings);
}

// Export a singleton for use across the app
let globalAdapter: OpencodeAdapter | null = null;
let globalProviderType: OpencodeProvider = "cli";

export function getOpencodeAdapter(
	settings?: OpencodeSettings,
	providerType?: OpencodeProvider,
): OpencodeAdapter {
	if (providerType && providerType !== globalProviderType) {
		globalProviderType = providerType;
		globalAdapter = null;
	}

	if (!globalAdapter && settings) {
		globalAdapter = createOpencodeAdapter(settings, globalProviderType);
	}

	if (!globalAdapter) {
		throw new Error(
			"Opencode adapter requested before settings were configured",
		);
	}

	return globalAdapter;
}

export function setOpencodeAdapter(adapter: OpencodeAdapter): void {
	globalAdapter = adapter;
}
