import { expect, test } from "@playwright/test";
import { resetAppState } from "./test-utils";

test.describe("Grant Operations Center smoke", () => {
	test.beforeEach(async ({ request, page }) => {
		await resetAppState(request);
		await page.goto("http://localhost:3000");
		await page.waitForSelector(".app", { timeout: 20000 });
	});

	test("shell loads with nav badges and footer", async ({ page }) => {
		await expect(page.locator(".brand-mark")).toContainText("Grant Ops");
		await expect(
			page.locator('.nav-item[data-view="discovery"] .nav-count'),
		).toBeVisible({ timeout: 15000 });
		await expect(
			page.locator('.nav-item[data-view="tasks"] .nav-count'),
		).toBeVisible({ timeout: 15000 });
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
			"http://localhost:3000/api/grants",
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
		await expect(page.locator('button:has-text("Export CSV")')).toBeVisible();
	});

	test("pipeline and settings sections render expected controls", async ({
		page,
	}) => {
		await page.click('[data-view="pipeline"]');
		await expect(page.locator(".board-col")).toHaveCount(5);
		await expect(
			page.locator('button:has-text("+ Add to pipeline")'),
		).toBeVisible();

		await page.click('[data-view="settings"]');
		await expect(page.locator(".upload-item")).toBeVisible();
		await expect(page.locator(".setting-card")).toHaveCount(5);
	});

	test("grant updates persist through the API", async ({ request }) => {
		const grantsResponse = await request.get(
			"http://localhost:3000/api/grants",
		);
		expect(grantsResponse.ok()).toBeTruthy();
		const grants: Array<{ id: string; status: string }> =
			await grantsResponse.json();
		const firstGrant = grants[0];
		expect(firstGrant).toBeDefined();

		const originalStatus = firstGrant.status;
		const nextStatus = originalStatus === "matched" ? "draft" : "matched";

		const updateResponse = await request.patch(
			`http://localhost:3000/api/grants/${firstGrant.id}/status`,
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
			`http://localhost:3000/api/grants/${firstGrant.id}`,
		);
		expect(getResponse.ok()).toBeTruthy();
		const updatedGrant = await getResponse.json();
		expect(updatedGrant.grant.status).toBe(nextStatus);

		await request.patch(`http://localhost:3000/api/grants/${firstGrant.id}`, {
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
