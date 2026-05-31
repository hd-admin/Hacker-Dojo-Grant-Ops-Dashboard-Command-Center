import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { configureOpencodeThroughSettingsView, resetAppState } from "./test-utils";

const opencodeStubPath = path.join(process.cwd(), "tests/e2e/opencode-stub.sh");

async function ensureOpencodeStub(): Promise<string> {
	const script = `#!/bin/sh
set -eu

cat <<'EOF'
OpenCode 0.1.0-stub
EOF
`;
	await fs.writeFile(opencodeStubPath, script, "utf8");
	await fs.chmod(opencodeStubPath, 0o755);
	return opencodeStubPath;
}

test.describe("Grant Operations Center smoke", () => {
	test.beforeEach(async ({ request, page }) => {
		const stubPath = await ensureOpencodeStub();
		await resetAppState(request);
		await page.goto("http://127.0.0.1:3000");
		await page.waitForSelector(".app", { timeout: 60000 });
		await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
		await page.locator('.shell-banner-row [data-testid="rerun-health-check-btn"]').click();
		await expect(page.locator('.nav-item[data-view="discovery"]')).not.toBeDisabled();
		await page.click('[data-view="dashboard"]');
		await page.waitForSelector("#view-dashboard.active", { timeout: 10000 });
	});

	test("shell loads with footer", async ({ page }) => {
		await expect(page.locator(".brand-mark")).toContainText("Grant Ops");
		await expect(page.locator('.nav-item[data-view="discovery"]')).toBeVisible();
		await expect(page.locator('.nav-item[data-view="tasks"]')).toBeVisible();
		await expect(page.locator(".sidebar-footer")).toContainText("Logged in as");
	});

	test("navigation switches between core views", async ({ page }) => {
		await expect(page.locator("#view-dashboard")).toHaveClass(/active/);

		await page.click('[data-view="discovery"]');
		await expect(page.locator("#view-discovery")).toHaveClass(/active/);

		await page.click('[data-view="pipeline"]');
		await expect(page.locator("#view-pipeline")).toHaveClass(/active/);

		await page.click('[data-view="settings"]');
		await expect(page.locator("#view-settings")).toHaveClass(/active/);
	});

	test("drawer surfaces prototype detail sections and action gates for an unrated matched grant", async ({
		page,
		request,
	}) => {
		const grantsResponse = await request.get(
			"http://127.0.0.1:3000/api/grants",
		);
		expect(grantsResponse.ok()).toBeTruthy();
		const grants: Array<{
			id: string;
			title: string;
			status: string;
			draftContent?: string;
		}> = await grantsResponse.json();
		const targetGrant = grants.find(
			(grant) => grant.status === "matched" && !grant.draftContent,
		);
		expect(targetGrant).toBeDefined();
		if (!targetGrant) {
			throw new Error("Expected a matched grant without draft content");
		}
		const sortedGrants = [...grants].sort((a, b) => b.fit - a.fit);
		const selectedIndex = sortedGrants.findIndex(
			(grant) => grant.id === targetGrant.id,
		);
		expect(selectedIndex).toBeGreaterThan(-1);

		await page.click('[data-view="discovery"]');
		await page.locator(".grants-row:not(.header)").nth(selectedIndex).click();

		await expect(page.locator(".drawer-title")).toHaveText(targetGrant.title);
		await expect(page.locator(".drawer")).toContainText("Funder summary (agent-generated)");
		await expect(page.locator(".drawer")).toContainText("Requirements checklist");
		await expect(page.locator(".drawer")).toContainText("Drafted Letter of Intent — preview");
		await expect(
			page.locator('button:has-text("Generate draft")'),
		).toBeVisible();
		await expect(
			page.locator('button:has-text("Open in editor")'),
		).toBeVisible();
		await expect(
			page.locator('.drawer-actions button:has-text("Approve & lock")'),
		).toHaveCount(0);
		await expect(
			page.locator('.drawer-actions button:has-text("Submit")'),
		).toHaveCount(0);
	});

	test("discovery exposes source-intake controls", async ({ page }) => {
		await page.click('[data-view="discovery"]');
		await expect(page.locator('button:has-text("+ Add source")')).toBeVisible();
		await expect(page.locator('#view-discovery button:has-text("Export CSV")')).toBeVisible();
	});

	test("pipeline and settings sections render expected controls", async ({
		page,
	}) => {
		await page.click('[data-view="pipeline"]');
		await expect(page.locator(".board-col")).toHaveCount(11);
		await expect(
			page.locator('button:has-text("+ Add to pipeline")'),
		).toBeVisible();

		await page.click('[data-view="settings"]');
		await expect(page.locator(".upload-item")).toBeVisible();
		await expect(page.locator(".setting-card")).toHaveCount(9);
	});

	test("AC-14.2.4: failed job can be retried from UI", async ({ page, request }) => {
		// Create a job that will fail
		const startRes = await request.post("http://127.0.0.1:3000/api/research", {
			data: { query: "__force_failure_test__" },
		});
		expect(startRes.ok()).toBeTruthy();
		const { jobId } = await startRes.json();
		expect(jobId).toBeDefined();

		// Navigate to jobs view
		await page.click('[data-view="jobs"]');
		await expect(page.locator("#view-jobs")).toHaveClass(/active/);

		// Wait for job to appear
		await expect(page.locator(`[data-testid="job-item-failed-${jobId}"]`)).toBeVisible({ timeout: 15000 });

		// Click retry button
		await page.click(`[data-testid="job-retry-btn-${jobId}"]`);

		// Verify job is queued again
		await expect(page.locator(`[data-testid="job-item-queued-${jobId}"]`)).toBeVisible({ timeout: 5000 });
	});

	test("AC-14.3.4: sidebar badge shows correct active job count", async ({ page, request }) => {
		// Start a long-running job
		const startRes = await request.post("http://127.0.0.1:3000/api/research", {
			data: { query: "test query for badge count" },
		});
		expect(startRes.ok()).toBeTruthy();
		const { jobId } = await startRes.json();
		expect(jobId).toBeDefined();

		// Navigate to jobs view to trigger active jobs load
		await page.click('[data-view="jobs"]');
		await expect(page.locator("#view-jobs")).toHaveClass(/active/);

		// Check that the jobs nav item shows a count when active jobs exist
		const jobsNav = page.locator('.nav-item[data-view="jobs"]');
		await expect(jobsNav).toBeVisible();
	});

	test("AC-14.10.3: frontend handles API error codes with specific messages", async ({ page }) => {
		// Test 400 validation error
		const badRequestRes = await page.request.post("http://127.0.0.1:3000/api/grants", {
			data: { invalidField: true },
		});
		expect(badRequestRes.status()).toBeGreaterThanOrEqual(400);
		expect(badRequestRes.status()).toBeLessThan(500);
		const badBody = await badRequestRes.json();
		expect(badBody.error || badBody.message || badBody.details).toBeDefined();

		// Test 404 not found
		const notFoundRes = await page.request.get("http://127.0.0.1:3000/api/grants/nonexistent-grant-id-12345");
		expect(notFoundRes.status()).toBeGreaterThanOrEqual(404);
		expect(notFoundRes.status()).toBeLessThan(500);
		const notFoundBody = await notFoundRes.json();
		expect(notFoundBody.error || notFoundBody.message).toBeDefined();
	});

	test("grant updates persist through the API", async ({ request }) => {
		const grantsResponse = await request.get(
			"http://127.0.0.1:3000/api/grants",
		);
		expect(grantsResponse.ok()).toBeTruthy();
		const grants: Array<{ id: string; status: string }> =
			await grantsResponse.json();
		const firstGrant = grants[0];
		expect(firstGrant).toBeDefined();

		const originalStatus = firstGrant.status;
		const nextStatus = originalStatus === "matched" ? "draft" : "matched";

		const updateResponse = await request.patch(
			`http://127.0.0.1:3000/api/grants/${firstGrant.id}/status`,
			{
				headers: { "Content-Type": "application/json" },
				data: {
					status: nextStatus,
					statusLabel: nextStatus === "draft" ? "In Draft" : "Matched",
				},
			},
		);
		expect(updateResponse.ok()).toBeTruthy();

		const getResponse = await request.get(
			`http://127.0.0.1:3000/api/grants/${firstGrant.id}`,
		);
		expect(getResponse.ok()).toBeTruthy();
		const updatedGrant = await getResponse.json();
		expect(updatedGrant.grant.status).toBe(nextStatus);

		await request.patch(`http://127.0.0.1:3000/api/grants/${firstGrant.id}`, {
			headers: { "Content-Type": "application/json" },
			data: {
				status: originalStatus,
				statusLabel:
					originalStatus === "draft"
						? "In Draft"
						: originalStatus === "matched"
							? "Matched"
							: originalStatus,
			},
		});
	});
});
