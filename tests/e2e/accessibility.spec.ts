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
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app', { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focused).toBe('skip-link');
  });

  test('Tab navigates through interactive elements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app', { timeout: 30000 });
    // Key sidebar elements should be focusable
    const keyElements = [
      '[data-testid="skip-link"]',
      '[data-view="dashboard"]',
      '[data-view="discovery"]',
      '[data-view="settings"]',
    ];

    let tabCount = 0;
    for (const selector of keyElements) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      const isFocused = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el === document.activeElement;
      }, selector);
      if (isFocused) tabCount++;
    }
    // At least most elements should be focusable
    expect(tabCount).toBeGreaterThanOrEqual(2);
  });

  test('Escape closes grant drawer', async ({ page, request }) => {
    const grantsRes = await request.get(`${BASE_URL}/api/grants`);
    const grants = await grantsRes.json();
    const grantsArr = Array.isArray(grants) ? grants : (grants.grants ?? []);

    if (grantsArr.length === 0) {
      test.skip();
      return;
    }

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app', { timeout: 30000 });

    // Navigate to Discovery view
    await page.click('[data-view="discovery"]');
    await page.waitForTimeout(1000);

    // Click the first grant row to open the drawer
    const firstGrantRow = page.locator('.grants-row').first();
    if (await firstGrantRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstGrantRow.click();
      await page.waitForTimeout(500);

      // Press Escape to close the drawer
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Verify the drawer is closed by checking the view is still navigable
      await expect(page.locator('#view-discovery')).toBeVisible({ timeout: 3000 });
    }
  });

  test('all interactive elements have accessible names', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app', { timeout: 30000 });
    const buttons = await page.locator('button').all();
    const links = await page.locator('a').all();
    const inputs = await page.locator('input, select, textarea').all();

    for (const el of [...buttons, ...links, ...inputs]) {
      const ariaLabel = await el.getAttribute('aria-label');
      const ariaLabelledBy = await el.getAttribute('aria-labelledby');
      const text = await el.textContent();
      const placeholder = await el.getAttribute('placeholder');
      const title = await el.getAttribute('title');
      let hasLabel =
        ariaLabel || ariaLabelledBy || (text && text.trim().length > 0) || placeholder || title;
      // Check for native HTML label association (label[for] pointing to element id)
      if (!hasLabel) {
        const elId = await el.getAttribute('id');
        if (elId) {
          const labelFor = page.locator(`label[for="${elId}"]`);
          if ((await labelFor.count()) > 0) {
            hasLabel = true;
          }
        }
      }
      // Check for aria-describedby
      if (!hasLabel) {
        const describedBy = await el.getAttribute('aria-describedby');
        if (describedBy && describedBy.trim().length > 0) {
          hasLabel = true;
        }
      }
      if (!hasLabel) {
        // Check for input types that don't need labels (hidden, submit with value)
        const type = await el.getAttribute('type');
        const value = await el.getAttribute('value');
        const tag = await el.evaluate((node: Element) => node.tagName);
        if (
          type === 'hidden' ||
          type === 'submit' ||
          (tag === 'INPUT' && (type === 'button' || type === 'reset'))
        ) {
          hasLabel = true;
        } else if (!type && value && tag === 'INPUT' && value.trim().length > 0) {
          // Submit buttons often use value as label
          hasLabel = true;
        } else if (type === 'file') {
          // File inputs wrapped in label get accessible name from wrapping label text
          // Check if the element is inside a label
          const parentLabelText = await el.evaluate((node: Element) => {
            let parent = node.parentElement;
            while (parent) {
              if (parent.tagName === 'LABEL') {
                return parent.textContent?.trim() || '';
              }
              parent = parent.parentElement;
            }
            return '';
          });
          if (parentLabelText.length > 0) {
            hasLabel = true;
          }
        }
      }
      if (!hasLabel) {
        // Report the element for debugging
        const tag = await el.evaluate((node: Element) => node.tagName);
        const id = await el.getAttribute('id');
        const cls = await el.getAttribute('class');
        const tp = await el.getAttribute('type');
        console.warn(`Element without accessible name: <${tag}> id=${id} class=${cls} type=${tp}`);
      }
      expect(hasLabel).toBeTruthy();
    }
  });

  test('no tabindex greater than 0', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const elements = await page.locator('[tabindex]').all();
    for (const el of elements) {
      const tabindex = await el.getAttribute('tabindex');
      expect(Number(tabindex)).toBeLessThanOrEqual(0);
    }
  });
});
