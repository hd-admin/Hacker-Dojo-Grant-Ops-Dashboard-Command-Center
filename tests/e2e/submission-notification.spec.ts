/**
 * Submission Notification E2E Tests
 *
 * Verifies the notification profile config and a lightweight drawer submission flow.
 */

import {
	type APIRequestContext,
	expect,
	type Page,
	test,
} from "@playwright/test";
import { resetAppState } from "./test-utils";

async function getDraftGrant(
	request: APIRequestContext,
): Promise<{ id: string; title: string; funder: string }> {
	const grantsResponse = await request.get("http://127.0.0.1:3000/api/grants");
	expect(grantsResponse.ok()).toBeTruthy();
	const grants: Array<{
		id: string;
		title: string;
		funder: string;
		status: string;
		draftContent?: string;
		fit: number;
	}> = await grantsResponse.json();
	const draftGrant = grants.find(
		(grant) => grant.status === "draft" && grant.draftContent,
	);
	expect(draftGrant).toBeDefined();
	if (!draftGrant) {
		throw new Error("Expected a draft grant for submission workflow tests");
	}
	return draftGrant;
}

async function openDraftGrantDrawer(page: Page, request: APIRequestContext) {
	const draftGrant = await getDraftGrant(request);
	const grantsResponse = await request.get("http://127.0.0.1:3000/api/grants");
	expect(grantsResponse.ok()).toBeTruthy();
	const grants: Array<{
		id: string;
		title: string;
		status: string;
		draftContent?: string;
		fit: number;
	}> = await grantsResponse.json();
	const selectedIndex = [...grants]
		.sort((a, b) => b.fit - a.fit)
		.findIndex((grant) => grant.id === draftGrant.id);
	expect(selectedIndex).toBeGreaterThan(-1);

	await page.click('[data-view="discovery"]');
	await page.locator(".grants-row:not(.header)").nth(selectedIndex).click();
	await expect(page.locator(".drawer-title")).toHaveText(draftGrant.title);

	return draftGrant;
}

test.describe("Submission Notification", () => {
	test.beforeEach(async ({ page, request }) => {
		await page.goto("http://127.0.0.1:3000");
		await page.waitForSelector(".app", { timeout: 10000 });
		await resetAppState(request);
		await page.reload();
		await page.waitForSelector(".app", { timeout: 10000 });
	});

	test("notify-email-is-configured: notifyEmail is set in profile", async ({
		page,
	}) => {
		const profile = await page.evaluate(async () => {
			const response = await fetch("/api/profile");
			return { status: response.status, body: await response.json() };
		});

		expect(profile.status).toBe(200);
		expect(profile.body.agentBehavior).toBeDefined();
		expect(profile.body.agentBehavior.notifyEmail).toBeDefined();
		expect(profile.body.agentBehavior.notifyEmail.length).toBeGreaterThan(0);
		expect(profile.body.agentBehavior.notifyEmail).toMatch(
			/^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		);
	});

	test("draft grant drawer surfaces the submission gate", async ({
		page,
		request,
	}) => {
		await openDraftGrantDrawer(page, request);
		await expect(page.locator(".drawer")).toContainText(
			"Submission blocked: Grant must be approved before submission",
		);
		await expect(page.locator(".drawer")).not.toContainText("Submit grant");
	});
});
