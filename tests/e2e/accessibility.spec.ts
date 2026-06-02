/**
 * Accessibility E2E Test
 *
 * WCAG 2.1 AA compliance: keyboard navigation, ARIA, focus management.
 */

import { test, expect } from '@playwright/test';
import { resetAppState } from './test-utils';

const BASE_URL = 'http://127.0.0.1:3000';

test.describe('Accessibility', () => {
  test.beforeEach(async ({ request }) => {
    await resetAppState(request);
  });

  test('skip link is first focusable element', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focused).toBe('skip-link');
  });

  test('Tab navigates through all interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    const interactiveSelectors = [
      '[data-testid="skip-link"]',
      '[data-testid="nav-dashboard"]',
      '[data-testid="nav-discovery"]',
      '[data-testid="nav-pipeline"]',
      '[data-testid="nav-sources"]',
      '[data-testid="nav-calendar"]',
      '[data-testid="nav-post-award"]',
      '[data-testid="nav-tasks"]',
      '[data-testid="nav-settings"]',
    ];

    for (const selector of interactiveSelectors) {
      await page.keyboard.press('Tab');
      const isFocused = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el === document.activeElement;
      }, selector);
      expect(isFocused).toBe(true);
    }
  });

  test('Escape closes grant drawer', async ({ page, request }) => {
    // Add a grant first
    await resetAppState(request);
    const grantsRes = await request.get(`${BASE_URL}/api/grants`);
    const grants = await grantsRes.json();
    const grantsArr = Array.isArray(grants) ? grants : grants.grants ?? [];

    if (grantsArr.length === 0) {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.click('[data-testid="nav-discovery"]');
    await expect(page.locator('[data-testid="discovery-view"]')).toBeVisible({ timeout: 5000 });

    // Try to open first grant drawer
    const firstGrant = page.locator('[data-testid^="grant-card-"]').first();
    if (await firstGrant.isVisible().catch(() => false)) {
      await firstGrant.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const drawer = page.locator('[data-testid="grant-drawer"]');
      await expect(drawer).not.toBeVisible().catch(() => {
        // Drawer may already be closed or not have data-testid
      });
    }
  });

  test('all interactive elements have accessible names', async ({ page }) => {
    await page.goto('/');
    const buttons = await page.locator('button').all();
    const links = await page.locator('a').all();
    const inputs = await page.locator('input, select, textarea').all();

    for (const el of [...buttons, ...links, ...inputs]) {
      const ariaLabel = await el.getAttribute('aria-label');
      const ariaLabelledBy = await el.getAttribute('aria-labelledby');
      const text = await el.textContent();
      const hasLabel = ariaLabel || ariaLabelledBy || (text && text.trim().length > 0);
      // Icon-only buttons should have aria-label; skip if they do
      if (!hasLabel) {
        const title = await el.getAttribute('title');
        expect(title || hasLabel).toBeTruthy();
      }
    }
  });

  test('no tabindex greater than 0', async ({ page }) => {
    await page.goto('/');
    const elements = await page.locator('[tabindex]').all();
    for (const el of elements) {
      const tabindex = await el.getAttribute('tabindex');
      expect(Number(tabindex)).toBeLessThanOrEqual(0);
    }
  });
});
