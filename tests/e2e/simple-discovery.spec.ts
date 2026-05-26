import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { configureOpencodeThroughSettingsView, resetAppState, saveProfileThroughSettingsView, uploadDocumentThroughSettingsView } from "./test-utils";

const opencodeStubPath = path.join(process.cwd(), "tests/e2e/opencode-stub.sh");

async function ensureOpencodeStub(): Promise<string> {
	const script = `#!/bin/sh
set -eu

all_args="$*"
json_output=0
case "$all_args" in
	*"Research grants for the following organization:"*|*"--output-format json"*|*"--format json"*)
		json_output=1
		;;
esac

if [ "$json_output" -eq 1 ]; then
	cat <<'EOF'
{"grants":[{"id":"stub-grant-001","title":"Education Technology Community Grant","funder":"Mock Foundation","funderShort":"Mock","award":"$50,000","awardSort":50000,"deadline":"2026-06-30","daysOut":30,"fit":82,"tags":["EdTech","Community"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-05-24T00:00:00.000Z"}],"evidence":[],"rationale":"E2E research stub response"}
EOF
else
	cat <<'EOF'
## Hacker Dojo Grant Proposal

Hacker Dojo expands access to technology education and community innovation in Silicon Valley.

This draft is grounded in the uploaded organization profile.
EOF
fi
`;
	await fs.writeFile(opencodeStubPath, script, "utf8");
	await fs.chmod(opencodeStubPath, 0o755);
	return opencodeStubPath;
}

test("simple-discovery: add source and refresh crawl state", async ({
	request,
	page,
}) => {
	const stubPath = await ensureOpencodeStub();
	await resetAppState(request);
	await page.goto("http://localhost:3000");
	await page.waitForSelector(".app", { timeout: 10000 });

	await saveProfileThroughSettingsView(
		page,
		"Community innovation and education with maker pathways.",
	);
	await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
	await uploadDocumentThroughSettingsView(
		page,
		"tests/fixtures/documents/hacker-dojo-program-summary.pdf",
	);

	const opencodeSettingsResponse = await request.get("http://localhost:3000/api/opencode-settings");
	expect(opencodeSettingsResponse.ok()).toBeTruthy();
	const opencodeSettings = await opencodeSettingsResponse.json() as { isConfigured: boolean; binaryPath: string };
	expect(opencodeSettings.isConfigured).toBe(true);
	expect(opencodeSettings.binaryPath).toBe(stubPath);

	await page.click("[data-view=\"settings\"]");
	await page.waitForSelector("#view-settings.active", { timeout: 10000 });
	await expect(page.locator(".setting-card").filter({ hasText: "Agent Behavior" })).toContainText("ed@hackerdojo.com");
	await page.click("[data-view=\"discovery\"]");

	await page.click('[data-view="discovery"]');
	await expect(page.locator("#view-discovery")).toHaveClass(/active/);

	const sourceResponse = await request.post("http://localhost:3000/api/sources", {
		data: {
			name: "Candid",
			url: "https://www.candid.org",
			type: "website",
		},
	});
	expect(sourceResponse.ok()).toBeTruthy();

	await expect(page.locator("button:has-text('+ Add source')")).toBeVisible();
	await expect(page.locator(".sidebar-footer")).toContainText("Logged in as");

	const sourcesResponse = await request.get("http://localhost:3000/api/sources");
	expect(sourcesResponse.ok()).toBeTruthy();
	const sources = (await sourcesResponse.json()) as Array<{
		name: string;
		url: string;
	}>;
	expect(
		sources.some(
			(source) =>
				source.name === "Candid" && source.url === "https://www.candid.org",
		),
	).toBe(true);

	const researchResponse = await request.post("http://localhost:3000/api/research");
	expect(researchResponse.ok()).toBeTruthy();

	await page.reload();
	await page.waitForSelector('.app', { timeout: 10000 });
	await page.click('[data-view="discovery"]');
	await expect(page.locator('.source-item')).toHaveCount(1);
	await expect(page.locator('.source-item .source-name')).toContainText('Candid');

	let research = null as {
		latestRun: { status: string; sourcesCrawled: number } | null;
	} | null;
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const researchResponse = await request.get("http://localhost:3000/api/research");
		expect(researchResponse.ok()).toBeTruthy();
		research = (await researchResponse.json()) as typeof research;
		if (
			research.latestRun?.status === "completed" &&
			research.latestRun.sourcesCrawled > 0
		) {
			break;
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	expect(research?.latestRun?.status).toBe("completed");
	expect(research?.latestRun?.sourcesCrawled).toBeGreaterThan(0);

	// Crawl status subtitle check
	await page.click('[data-view="discovery"]');
	await expect(page.locator('#view-discovery .header-sub')).toContainText('crawled');

	await expect(page.locator(".sidebar-footer")).toContainText("Crawler");
});
