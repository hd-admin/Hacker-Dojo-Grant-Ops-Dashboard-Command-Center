/**
 * Opencode Client Tests
 *
 * Tests the Opencode adapter contract:
 * - CLI provider requires configured settings
 * - Unconfigured settings fail explicitly
 * - Fake provider works without configuration
 * - Research and draft generation work correctly
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { OpencodeSettings } from "../../../../shared/types";
import {
	classifyOpencodeError,
	createOpencodeAdapter,
	normalizeOpencodeOutput,
} from "./opencode-client";

const defaultSettings: OpencodeSettings = {
	binaryPath: "/usr/local/bin/opencode",
	workingDirectory: "/Users/test/opencode",
	timeoutMs: 60000,
	profile: "grant-research",
	isConfigured: false,
};

describe("OpencodeClient", () => {
	describe("CLI provider", () => {
		it("isConfigured returns false when binaryPath is empty", () => {
			const settings: OpencodeSettings = {
				...defaultSettings,
				binaryPath: "",
				isConfigured: false,
			};
			const adapter = createOpencodeAdapter(settings, "cli");
			expect(adapter.isConfigured()).toBe(false);
		});

		it("isConfigured returns true when binaryPath is set and isConfigured is true", () => {
			const settings: OpencodeSettings = {
				...defaultSettings,
				binaryPath: "/usr/local/bin/opencode",
				isConfigured: true,
			};
			const adapter = createOpencodeAdapter(settings, "cli");
			expect(adapter.isConfigured()).toBe(true);
		});

		it("executeResearch fails explicitly when not configured", async () => {
			const settings: OpencodeSettings = {
				...defaultSettings,
				binaryPath: "",
				isConfigured: false,
			};
			const adapter = createOpencodeAdapter(settings, "cli");
			const result = await adapter.executeResearch({
				organizationProfile: "Test Org",
				searchThemes: ["EdTech"],
			});
			expect(result.success).toBe(false);
			expect(result.error).toContain("not configured");
		});

		it("executeResearch uses the wrapper-compatible run prompt --format json contract", async () => {
			const tempDir = fs.mkdtempSync(
				path.join(os.tmpdir(), "opencode-client-contract-"),
			);
			const fakeOpencode = path.join(tempDir, "opencode-fake.sh");
			const argsFile = path.join(tempDir, "args.txt");
			const expectedJson = JSON.stringify({
				grants: [],
				evidence: [],
				rationale: "ok",
			});

			fs.writeFileSync(
				fakeOpencode,
				`#!/bin/sh
set -eu
printf '%s\n' "$*" > "$ARGS_FILE"
cat <<'EOF'
${expectedJson}
EOF
`,
				"utf8",
			);
			fs.chmodSync(fakeOpencode, 0o755);

			const previousArgsFile = process.env.ARGS_FILE;
			process.env.ARGS_FILE = argsFile;

			try {
				const settings: OpencodeSettings = {
					...defaultSettings,
					binaryPath: fakeOpencode,
					workingDirectory: tempDir,
					isConfigured: true,
				};
				const adapter = createOpencodeAdapter(settings, "cli");
				const result = await adapter.executeResearch({
					organizationProfile: "Test Org",
					searchThemes: ["EdTech", "Community"],
					sourceName: "Candid",
					sourceUrl: "https://www.candid.org",
				});

				expect(result.success).toBe(true);
				expect(result.content).toBe(expectedJson);
				const args = fs.readFileSync(argsFile, "utf8").trim();
				expect(args).toContain("run");
				expect(args).toContain("--format json");
				expect(args).toContain("Find 1-3 real grant opportunities");
				expect(args).toContain(
					'Do not invent placeholder or "plausible" grants',
				);
				expect(args).toContain("Organization profile:\nTest Org");
				expect(args).toContain("Search themes:\nEdTech, Community");
				expect(args).toContain("Source name: Candid");
				expect(args).toContain("Source URL: https://www.candid.org");
				expect(args).not.toContain("Do not browse or research");
				expect(args).not.toContain("--output-format json");
				expect(args).not.toContain("--dangerously-skip-permissions");
			} finally {
				process.env.ARGS_FILE = previousArgsFile;
				fs.rmSync(tempDir, { recursive: true, force: true });
			}
		});

		it("generateDraft fails explicitly when not configured", async () => {
			const settings: OpencodeSettings = {
				...defaultSettings,
				binaryPath: "",
				isConfigured: false,
			};
			const adapter = createOpencodeAdapter(settings, "cli");
			const result = await adapter.generateDraft({
				grantTitle: "Test Grant",
				grantFunder: "Test Funder",
				organizationProfile: "Test Org",
				missionStatement: "Test mission",
			});
			expect(result.success).toBe(false);
			expect(result.error).toContain("not configured");
		});
	});

	describe("Fake provider", () => {
		it("isConfigured returns true for fake provider", () => {
			const adapter = createOpencodeAdapter(defaultSettings, "fake");
			expect(adapter.isConfigured()).toBe(true);
		});

		it("executeResearch returns mock data", async () => {
			const adapter = createOpencodeAdapter(defaultSettings, "fake");
			const result = await adapter.executeResearch({
				organizationProfile: "Test Org",
				searchThemes: ["EdTech", "Community"],
			});
			expect(result.success).toBe(true);
			expect(result.content).toBeDefined();
			if (!result.content) {
				throw new Error("Expected research content");
			}
			const data = JSON.parse(result.content);
			expect(data.grants).toBeDefined();
			expect(Array.isArray(data.grants)).toBe(true);
		});

		it("generateDraft returns mock draft content", async () => {
			const adapter = createOpencodeAdapter(defaultSettings, "fake");
			const result = await adapter.generateDraft({
				grantTitle: "Test Grant",
				grantFunder: "Test Funder",
				organizationProfile: "Test Org",
				missionStatement: "Test mission",
			});
			expect(result.success).toBe(true);
			expect(result.content).toBeDefined();
			expect(result.content).toContain("Test Grant");
		});
	});

	describe("Output normalization", () => {
		it("extracts text payloads from Opencode JSON event streams", () => {
			const output = [
				'{"type":"step_start","part":{"type":"step-start"}}',
				'{"type":"text","part":{"text":"first line"}}',
				'{"type":"text","part":{"text":"second line"}}',
				'{"type":"step_finish","part":{"type":"step-finish"}}',
			].join("\n");

			expect(normalizeOpencodeOutput(output)).toBe("first line\nsecond line");
			expect(normalizeOpencodeOutput(" plain text ")).toBe("plain text");
		});
	});

	describe("classifyOpencodeError", () => {
		it('classifies missing binary as install-missing', () => {
			expect(classifyOpencodeError('ENOENT: no such file or directory')).toBe('install-missing');
			expect(classifyOpencodeError('command not found: opencode')).toBe('install-missing');
			expect(classifyOpencodeError('opencode is not installed')).toBe('install-missing');
		});

		it('classifies auth/permission errors as config-error', () => {
			expect(classifyOpencodeError('API key not set', 'Authentication failed')).toBe('config-error');
			expect(classifyOpencodeError('EACCES: permission denied')).toBe('config-error');
			expect(classifyOpencodeError('Profile "custom" not found')).toBe('config-error');
		});

		it('classifies rate limiting as rate-limit', () => {
			expect(classifyOpencodeError('429 Too Many Requests')).toBe('rate-limit');
			expect(classifyOpencodeError('Rate limit exceeded', 'quota exceeded for today')).toBe('rate-limit');
		});

		it('classifies parse errors as malformed-output', () => {
			expect(classifyOpencodeError('SyntaxError: Unexpected token in JSON')).toBe('malformed-output');
			expect(classifyOpencodeError('malformed response from model')).toBe('malformed-output');
		});

		it('classifies token limit errors as context-overflow', () => {
			expect(classifyOpencodeError('Context length exceeded 128000 tokens')).toBe('context-overflow');
			expect(classifyOpencodeError('input is too long, maximum context window is 200k')).toBe('context-overflow');
		});

		it('classifies truncated output as partial-output', () => {
			expect(classifyOpencodeError('output was truncated')).toBe('partial-output');
			expect(classifyOpencodeError('stream closed unexpectedly', 'broken pipe')).toBe('partial-output');
		});

		it('classifies model unavailable as model-unavailable', () => {
			expect(classifyOpencodeError('Model "gpt-5" not found')).toBe('model-unavailable');
			expect(classifyOpencodeError('503 Service Unavailable')).toBe('model-unavailable');
			expect(classifyOpencodeError('server overloaded')).toBe('model-unavailable');
		});

		it('classifies timeout as timeout', () => {
			expect(classifyOpencodeError('Operation timed out')).toBe('timeout');
			expect(classifyOpencodeError('execution deadline exceeded')).toBe('timeout');
		});

		it('detects timeout by exit code 124', () => {
			expect(classifyOpencodeError('process exited', '', 124)).toBe('timeout');
		});

		it('returns unknown for unrecognized errors', () => {
			expect(classifyOpencodeError('something went wrong')).toBe('unknown');
		});
	});

	describe("Provider selection", () => {
		it("uses fake provider when specified", () => {
			const adapter = createOpencodeAdapter(defaultSettings, "fake");
			expect(adapter.isConfigured()).toBe(true);
		});

		it("uses cli provider when specified", () => {
			const settings: OpencodeSettings = {
				...defaultSettings,
				isConfigured: true,
			};
			const adapter = createOpencodeAdapter(settings, "cli");
			expect(adapter.isConfigured()).toBe(true);
		});
	});
});
