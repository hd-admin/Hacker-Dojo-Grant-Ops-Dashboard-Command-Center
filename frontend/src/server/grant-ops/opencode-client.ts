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

export interface OpencodeResponse {
	success: boolean;
	content?: string;
	error?: string;
	exitCode?: number;
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

export type OpencodeProvider = "cli" | "fake";

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
					title: `${request.searchThemes[0] || "Technology"} Community Grant`,
					funder: "Mock Foundation",
					funderShort: "Mock",
					award: "$50,000",
					awardSort: 50000,
					deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
						.toISOString()
						.split("T")[0],
					daysOut: 30,
					fit: 82,
					tags: ["Community", "Technology"],
					status: "matched" as const,
					statusLabel: "Matched",
					matchedAt: new Date().toISOString(),
				},
			],
			evidence: [],
			rationale: "Mock research completed successfully",
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

			const proc = spawn(binaryPath, args, {
				cwd: this.settings.workingDirectory || process.cwd(),
				stdio: ['ignore', 'pipe', 'pipe'],
				timeout: this.settings.timeoutMs || 60000,
			});

			let stdout = "";
			let stderr = "";
			let settled = false;
			let timeoutHandle: NodeJS.Timeout | null = null;

			const settle = (response: OpencodeResponse): void => {
				if (settled) {
					return;
				}
				settled = true;
				if (timeoutHandle) {
					clearTimeout(timeoutHandle);
					timeoutHandle = null;
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
					settle({
						success: false,
						error: stderr.trim() || `Opencode exited with code ${code}`,
						exitCode: code ?? 1,
					});
				}
			});

			proc.on("error", (err) => {
				settle({
					success: false,
					error: `Failed to execute Opencode: ${err.message}`,
					exitCode: 1,
				});
			});

			timeoutHandle = setTimeout(() => {
				proc.kill();
				settle({
					success: false,
					error: `Opencode timed out after ${this.settings.timeoutMs || 60000}ms`,
					exitCode: 124,
				});
			}, this.settings.timeoutMs || 60000);
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

		const prompt = `Return only valid JSON, with no markdown, fences, or extra text. Do not call tools, browse, or delegate tasks. Fill in this JSON object with one plausible grant aligned to Hacker Dojo's EdTech and Community themes. Keep the same keys and output only JSON.

{"grants":[{"id":"g1","title":"Plausible title","funder":"Plausible funder","funderShort":"Plausible","award":"$50,000","awardSort":50000,"deadline":"2026-06-30","daysOut":30,"fit":80,"tags":["EdTech","Community"],"status":"matched","statusLabel":"Matched"}],"evidence":[],"rationale":"plausible"}

Organization Profile:
${request.organizationProfile}

Search Themes: ${request.searchThemes.join(", ")}
${request.sourceName ? `\nSpecific Source: ${request.sourceName}${request.sourceUrl ? ` (${request.sourceUrl})` : ""}` : ""}`;

		const args = [
			"run",
			prompt,
			"--output-format",
			"json",
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

		let prompt = `Generate a concise grant proposal draft (under 300 words) for:

Do not call tools, browse, or delegate tasks. Use only the provided grant details, organization profile, mission statement, and grounding documents.

Write three short sections: Executive Summary, Program Description, and Conclusion.

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
export function createOpencodeAdapter(
	settings: OpencodeSettings,
	providerType: OpencodeProvider = "cli",
): OpencodeAdapter {
	if (providerType === "fake") {
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
