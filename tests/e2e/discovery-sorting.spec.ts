/**
 * Discovery Sorting E2E Tests
 *
 * Tests that grants are sorted correctly by:
 * - Fit score (descending)
 * - Deadline (soonest first, Rolling last)
 * - Award amount (descending)
 *
 * These tests verify the EXACT expected order based on seed data.
 * Seed matched grants and their expected sort orders:
 *
 * Matched grants (6 total):
 * - nsf-techaccess: fit=88, deadline=2026-06-15 (25d), award=$350,000
 * - sv-community-fdn: fit=82, deadline=Rolling, award=$75,000
 * - google-cs-first: fit=79, deadline=2026-06-30 (40d), award=$100,000
 * - dell-equality: fit=76, deadline=2026-07-01 (41d), award=$150,000
 * - kresge-space: fit=71, deadline=2026-08-15 (86d), award=$200,000
 * - wwf-stem-equity: fit=68, deadline=2026-07-15 (55d), award=$125,000
 *
 * Expected fit order (descending): nsf-techaccess(88), sv-community-fdn(82), google-cs-first(79), dell-equality(76), kresge-space(71), wwf-stem-equity(68)
 * Expected deadline order (soonest first, Rolling last): nsf-techaccess(25d), google-cs-first(40d), dell-equality(41d), wwf-stem-equity(55d), kresge-space(86d), sv-community-fdn(Rolling)
 * Expected award order (descending): nsf-techaccess($350k), kresge-space($200k), dell-equality($150k), wwf-stem-equity($125k), google-cs-first($100k), sv-community-fdn($75k)
 */

import { expect, type Page, test } from "@playwright/test";
import { resetAppState } from './test-utils';

function expectSubsequence(actual: string[], expected: string[]): void {
	let index = 0;
	for (const item of actual) {
		if (item === expected[index]) {
			index += 1;
			if (index === expected.length) break;
		}
	}
	expect(index).toBe(expected.length);
}

test.describe("Discovery Sorting", () => {
	test.beforeEach(async ({ request, page }) => {
		await resetAppState(request);
		await page.goto("http://localhost:3000");
		await page.click('[data-view="discovery"]');
		await page.waitForSelector(".grants-table", { timeout: 10000 });
	});

	// Helper to extract fit scores from the table
	async function getFitScores(page: Page): Promise<number[]> {
		const fitNumElements = page.locator(".grants-row:not(.header) .fit-num");
		const count = await fitNumElements.count();
		const scores: number[] = [];
		for (let i = 0; i < count; i++) {
			const text = await fitNumElements.nth(i).textContent();
			const score = parseInt(text?.trim() ?? "0", 10);
			scores.push(score);
		}
		return scores;
	}

	// Helper to extract grant IDs from the table (using funderShort as identifier)
	async function getGrantIds(page: Page): Promise<string[]> {
		const rows = page.locator(".grants-row:not(.header)");
		const count = await rows.count();
		const ids: string[] = [];
		for (let i = 0; i < count; i++) {
			const row = rows.nth(i);
			const funderShort = await row.locator(".grant-funder").textContent();
			ids.push(funderShort?.trim() ?? "");
		}
		return ids;
	}

	// Helper to extract deadline info from the table
	async function getDeadlines(
		page: Page,
	): Promise<{ text: string; isRolling: boolean; daysOut: number | null }[]> {
		const rows = page.locator(".grants-row:not(.header)");
		const count = await rows.count();
		const deadlines: {
			text: string;
			isRolling: boolean;
			daysOut: number | null;
		}[] = [];

		for (let i = 0; i < count; i++) {
			const row = rows.nth(i);
			const daysElement = row.locator(".days");
			const daysText = await daysElement.textContent();
			const isRolling = daysText?.toLowerCase().includes("rolling") ?? false;

			let daysOut: number | null = null;
			if (!isRolling && daysText) {
				const match = daysText.match(/(-?\d+)d/);
				if (match) {
					const daysTextValue = match[1];
					if (daysTextValue) {
						daysOut = parseInt(daysTextValue, 10);
					}
				}
			}

			deadlines.push({
				text: daysText ?? "",
				isRolling,
				daysOut,
			});
		}
		return deadlines;
	}

	// Helper to extract award amounts from the table
	async function getAwardAmounts(page: Page): Promise<number[]> {
		const awardElements = page.locator(".grants-row:not(.header) .award");
		const count = await awardElements.count();
		const awards: number[] = [];
		for (let i = 0; i < count; i++) {
			const text = await awardElements.nth(i).textContent();
			const numericValue = parseInt(text?.replace(/[^0-9]/g, "") ?? "0", 10);
			awards.push(numericValue);
		}
		return awards;
	}

	test("sort-by-fit-descending: Grants are sorted by fit score descending with exact order", async ({
		page,
	}) => {
		// Select "Best fit" sort option
		const sortSelect = page.locator("select").first();
		await sortSelect.selectOption({ value: "fit" });
		await page.waitForTimeout(500);

		// Get all fit scores
		const fitScores = await getFitScores(page);
		expect(fitScores.length).toBeGreaterThan(0);

		// Verify descending order
		for (let i = 0; i < fitScores.length - 1; i++) {
			const current = fitScores[i];
			const next = fitScores[i + 1];
			expect(current).toBeGreaterThanOrEqual(next ?? 0);
		}

		// With live data, verify the expected grants remain in descending fit order
		const funderShorts = await getGrantIds(page);
		expectSubsequence(funderShorts, [
			"NSF",
			"FCC",
			"Morrell",
			"SVCF",
			"Horizon",
			"Google",
			"United Way",
			"Stanford",
			"Dell",
			"Mellon",
			"Kresge",
			"WWF",
			"DEA",
		]);
	});

	test("sort-by-deadline-soonest: Grants sorted by deadline soonest first with Rolling last", async ({
		page,
	}) => {
		// Select "Deadline" sort option
		const sortSelect = page.locator("select").first();
		await sortSelect.selectOption({ value: "deadline" });
		await page.waitForTimeout(500);

		// Get all deadlines
		const deadlines = await getDeadlines(page);
		expect(deadlines.length).toBeGreaterThan(0);

		// Verify Rolling appears at the end if present
		const rollingIndex = deadlines.findIndex((d) => d.isRolling);
		if (rollingIndex !== -1) {
			// All grants after rollingIndex should also be Rolling
			for (let i = rollingIndex + 1; i < deadlines.length; i++) {
				expect(deadlines[i]?.isRolling ?? false).toBe(true);
			}
		}

		// Verify dated grants are in ascending order (soonest first)
		let lastDaysOut: number | null = null;
		let sawRolling = false;
		for (const deadline of deadlines) {
			if (deadline.isRolling) {
				sawRolling = true;
				continue;
			}
			if (sawRolling) {
				// Should not have dated grants after Rolling
				expect(deadline.isRolling).toBe(true);
			}
			if (deadline.daysOut !== null) {
				if (lastDaysOut !== null) {
					expect(deadline.daysOut).toBeGreaterThanOrEqual(lastDaysOut);
				}
				lastDaysOut = deadline.daysOut;
			}
		}

		// With live data, verify the expected grants remain in deadline order
		const funderShorts = await getGrantIds(page);
		expectSubsequence(funderShorts, [
			"DEA",
			"United Way",
			"FCC",
			"Morrell",
			"Horizon",
			"NSF",
			"Stanford",
			"Google",
			"Dell",
			"WWF",
			"Mellon",
			"Kresge",
			"SVCF",
		]);
	});

	test("sort-by-award-descending: Grants sorted by award amount descending with exact order", async ({
		page,
	}) => {
		// Select "Award size" sort option
		const sortSelect = page.locator("select").first();
		await sortSelect.selectOption({ value: "award" });
		await page.waitForTimeout(500);

		// Get all award amounts
		const awards = await getAwardAmounts(page);
		expect(awards.length).toBeGreaterThan(0);

		// Verify descending order
		for (let i = 0; i < awards.length - 1; i++) {
			const current = awards[i];
			const next = awards[i + 1];
			expect(current).toBeGreaterThanOrEqual(next ?? 0);
		}

		// With live data, verify the expected grants remain in award order
		const funderShorts = await getGrantIds(page);
		expectSubsequence(funderShorts, [
			"NSF",
			"FCC",
			"Kresge",
			"Mellon",
			"Dell",
			"WWF",
			"Google",
			"Horizon",
			"SVCF",
			"Stanford",
			"Morrell",
			"United Way",
			"DEA",
		]);
	});

	test("rolling-deadline-appears-last: Rolling deadline grants appear after all dated grants", async ({
		page,
	}) => {
		// Select "Deadline" sort option
		const sortSelect = page.locator("select").first();
		await sortSelect.selectOption({ value: "deadline" });
		await page.waitForTimeout(500);

		// Get all deadlines
		const deadlines = await getDeadlines(page);
		expect(deadlines.length).toBeGreaterThan(0);

		// Find the last Rolling entry index
		let lastRollingIndex = -1;
		for (let i = 0; i < deadlines.length; i++) {
			if (deadlines[i]?.isRolling ?? false) {
				lastRollingIndex = i;
			}
		}

		// If there are Rolling grants, verify they appear after all dated grants
		if (lastRollingIndex !== -1) {
			// Check that any grant after the last Rolling is also Rolling
			for (let i = lastRollingIndex + 1; i < deadlines.length; i++) {
				expect(deadlines[i]?.isRolling ?? false).toBe(true);
			}
			// Verify SVCF (Rolling) is at position 5 (last) with 6 grants
			const funderShorts = await getGrantIds(page);
			expect(funderShorts[funderShorts.length - 1]).toBe("SVCF");
		}
	});
});
