import { test, expect } from '@playwright/test';
import { resetAppState } from './test-utils';

test('simple-discovery: Navigate to discovery view and wait for grants table', async ({ request, page }) => {
  await resetAppState(request);
  await page.goto('http://localhost:3000');
  await page.waitForSelector('.app', { timeout: 10000 });
  await expect(page.locator('[data-view="discovery"]')).toBeVisible();

  const grants = await page.evaluate(async () => {
    const response = await fetch('/api/grants?sortBy=fit');
    if (!response.ok) {
      throw new Error(`Failed to load grants: ${response.status}`);
    }

    return response.json() as Promise<Array<{ id: string; fit: number }>>;
  });

  expect(Array.isArray(grants)).toBe(true);
  expect(grants.length).toBeGreaterThan(0);
  expect(grants[0]).toHaveProperty('id');
  expect(grants[0]).toHaveProperty('fit');
});
