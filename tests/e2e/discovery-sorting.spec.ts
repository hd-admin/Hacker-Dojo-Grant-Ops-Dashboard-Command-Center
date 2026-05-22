/**
 * Discovery Sorting E2E Tests
 *
 * Tests that grants are sorted correctly by:
 * - Fit score (descending)
 * - Deadline (soonest first, Rolling last)
 * - Award amount (descending)
 */

import { test, expect } from '@playwright/test';

test.describe('Discovery Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('[data-view="discovery"]');
    await page.waitForSelector('.grants-table', { timeout: 10000 });
  });

  test('sort-by-fit-descending: Grants are sorted by fit score descending', async ({ page }) => {
    // Select "Best fit" sort option
    const sortSelect = page.locator('select').first();
    await sortSelect.selectOption({ label: 'Best fit' });
    await page.waitForTimeout(500);

    // Get all grant rows
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Extract fit scores
    const fitScores: number[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const fitText = await row.locator('.fit-score, [class*="fit"]').textContent();
      const fit = parseInt(fitText?.replace(/[^0-9]/g, '') ?? '0', 10);
      fitScores.push(fit);
    }

    // Verify descending order
    for (let i = 0; i < fitScores.length - 1; i++) {
      expect(fitScores[i]!).toBeGreaterThanOrEqual(fitScores[i + 1]!);
    }
  });

  test('sort-by-deadline-soonest: Grants sorted by deadline soonest first', async ({ page }) => {
    // Select "Deadline" sort option
    const sortSelect = page.locator('select').first();
    await sortSelect.selectOption({ label: 'Deadline' });
    await page.waitForTimeout(500);

    // Get all grant rows
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Extract deadlines
    const deadlines: { text: string; date: Date | null }[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const deadlineText = await row.locator('.deadline, [class*="deadline"]').textContent();
      deadlines.push({
        text: deadlineText ?? '',
        date: deadlineText?.toLowerCase().includes('rolling')
          ? null
          : new Date(deadlineText ?? '9999-12-31'),
      });
    }

    // Find the index of the first "Rolling" entry
    const rollingIndex = deadlines.findIndex((d) => d.text.toLowerCase().includes('rolling'));

    // All dated grants should come before Rolling
    if (rollingIndex !== -1) {
      for (let i = 0; i < rollingIndex; i++) {
        expect(deadlines[i]!.date).not.toBeNull();
      }
    }

    // Verify dated grants are in ascending order (soonest first)
    let lastDate: Date | null = null;
    for (const deadline of deadlines) {
      if (deadline.date !== null) {
        if (lastDate !== null) {
          expect(deadline.date.getTime()).toBeGreaterThanOrEqual(lastDate.getTime());
        }
        lastDate = deadline.date;
      }
    }
  });

  test('sort-by-award-descending: Grants sorted by award amount descending', async ({ page }) => {
    // Select "Award size" sort option
    const sortSelect = page.locator('select').first();
    await sortSelect.selectOption({ label: 'Award size' });
    await page.waitForTimeout(500);

    // Get all grant rows
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Extract award amounts
    const awards: number[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const awardText = await row.locator('.award-amount, [class*="award"]').textContent();
      // Extract numeric value from text like "$250,000"
      const numericValue = parseInt(awardText?.replace(/[^0-9]/g, '') ?? '0', 10);
      awards.push(numericValue);
    }

    // Verify descending order
    for (let i = 0; i < awards.length - 1; i++) {
      expect(awards[i]!).toBeGreaterThanOrEqual(awards[i + 1]!);
    }
  });

  test('rolling-deadline-appears-last: Rolling deadline grants appear after dated grants', async ({ page }) => {
    // Select "Deadline" sort option
    const sortSelect = page.locator('select').first();
    await sortSelect.selectOption({ label: 'Deadline' });
    await page.waitForTimeout(500);

    // Get all grant rows
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();

    // Find the last row with "Rolling"
    let lastRollingIndex = -1;
    let _lastRollingText = '';
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const deadlineText = await row.locator('.deadline, [class*="deadline"]').textContent();
      if (deadlineText?.toLowerCase().includes('rolling')) {
        lastRollingIndex = i;
        _lastRollingText = deadlineText ?? '';
      }
    }

    // If there are Rolling grants, verify they appear after all dated grants
    if (lastRollingIndex !== -1) {
      // Check that any grant after the last Rolling is also Rolling
      for (let i = lastRollingIndex + 1; i < count; i++) {
        const row = rows.nth(i);
        const deadlineText = await row.locator('.deadline, [class*="deadline"]').textContent();
        expect(deadlineText?.toLowerCase()).toContain('rolling');
      }
    }
  });
});
