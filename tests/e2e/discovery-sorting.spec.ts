/**
 * Discovery Sorting E2E Tests
 *
 * Tests that grants are sorted correctly by:
 * - Fit score (descending)
 * - Deadline (soonest first, Rolling last)
 * - Award amount (descending)
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Discovery Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('[data-view="discovery"]');
    await page.waitForSelector('.grants-table', { timeout: 10000 });
  });

  // Helper to extract fit scores from the table
  async function getFitScores(page: Page): Promise<number[]> {
    const fitNumElements = page.locator('.grants-row:not(.header) .fit-num');
    const count = await fitNumElements.count();
    const scores: number[] = [];
    for (let i = 0; i < count; i++) {
      const text = await fitNumElements.nth(i).textContent();
      const score = parseInt(text?.trim() ?? '0', 10);
      scores.push(score);
    }
    return scores;
  }

  // Helper to extract deadline info from the table
  async function getDeadlines(page: Page): Promise<{ text: string; isRolling: boolean; daysOut: number | null }[]> {
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    const deadlines: { text: string; isRolling: boolean; daysOut: number | null }[] = [];
    
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const daysElement = row.locator('.days');
      const daysText = await daysElement.textContent();
      const isRolling = daysText?.toLowerCase().includes('rolling') ?? false;
      
      let daysOut: number | null = null;
      if (!isRolling && daysText) {
        const match = daysText.match(/(\d+)d/);
        if (match) {
          daysOut = parseInt(match[1]!, 10);
        }
      }
      
      deadlines.push({
        text: daysText ?? '',
        isRolling,
        daysOut,
      });
    }
    return deadlines;
  }

  // Helper to extract award amounts from the table
  async function getAwardAmounts(page: Page): Promise<number[]> {
    const awardElements = page.locator('.grants-row:not(.header) .award');
    const count = await awardElements.count();
    const awards: number[] = [];
    for (let i = 0; i < count; i++) {
      const text = await awardElements.nth(i).textContent();
      const numericValue = parseInt(text?.replace(/[^0-9]/g, '') ?? '0', 10);
      awards.push(numericValue);
    }
    return awards;
  }

  test('sort-by-fit-descending: Grants are sorted by fit score descending', async ({ page }) => {
    // Select "Best fit" sort option
    const sortSelect = page.locator('select').first();
    await sortSelect.selectOption({ value: 'fit' });
    await page.waitForTimeout(500);

    // Get all fit scores
    const fitScores = await getFitScores(page);
    expect(fitScores.length).toBeGreaterThan(0);

    // Verify descending order
    for (let i = 0; i < fitScores.length - 1; i++) {
      expect(fitScores[i]!).toBeGreaterThanOrEqual(fitScores[i + 1]!);
    }
  });

  test('sort-by-deadline-soonest: Grants sorted by deadline soonest first', async ({ page }) => {
    // Select "Deadline" sort option
    const sortSelect = page.locator('select').first();
    await sortSelect.selectOption({ value: 'deadline' });
    await page.waitForTimeout(500);

    // Get all deadlines
    const deadlines = await getDeadlines(page);
    expect(deadlines.length).toBeGreaterThan(0);

    // Find the first Rolling entry index
    const rollingIndex = deadlines.findIndex((d) => d.isRolling);
    
    // All dated grants should come before Rolling
    if (rollingIndex !== -1) {
      for (let i = 0; i < rollingIndex; i++) {
        expect(deadlines[i]!.daysOut).not.toBeNull();
      }
    }

    // Verify dated grants are in ascending order (soonest first)
    let lastDaysOut: number | null = null;
    for (const deadline of deadlines) {
      if (!deadline.isRolling && deadline.daysOut !== null) {
        if (lastDaysOut !== null) {
          expect(deadline.daysOut).toBeGreaterThanOrEqual(lastDaysOut);
        }
        lastDaysOut = deadline.daysOut;
      }
    }
  });

  test('sort-by-award-descending: Grants sorted by award amount descending', async ({ page }) => {
    // Select "Award size" sort option
    const sortSelect = page.locator('select').first();
    await sortSelect.selectOption({ value: 'award' });
    await page.waitForTimeout(500);

    // Get all award amounts
    const awards = await getAwardAmounts(page);
    expect(awards.length).toBeGreaterThan(0);

    // Verify descending order
    for (let i = 0; i < awards.length - 1; i++) {
      expect(awards[i]!).toBeGreaterThanOrEqual(awards[i + 1]!);
    }
  });

  test('rolling-deadline-appears-last: Rolling deadline grants appear after dated grants', async ({ page }) => {
    // Select "Deadline" sort option
    const sortSelect = page.locator('select').first();
    await sortSelect.selectOption({ value: 'deadline' });
    await page.waitForTimeout(500);

    // Get all deadlines
    const deadlines = await getDeadlines(page);
    expect(deadlines.length).toBeGreaterThan(0);

    // Find the last Rolling entry index
    let lastRollingIndex = -1;
    for (let i = 0; i < deadlines.length; i++) {
      if (deadlines[i]!.isRolling) {
        lastRollingIndex = i;
      }
    }

    // If there are Rolling grants, verify they appear after all dated grants
    if (lastRollingIndex !== -1) {
      // Check that any grant after the last Rolling is also Rolling
      for (let i = lastRollingIndex + 1; i < deadlines.length; i++) {
        expect(deadlines[i]!.isRolling).toBe(true);
      }
    }
  });
});
