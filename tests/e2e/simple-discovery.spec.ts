import { test, expect } from '@playwright/test';

test('simple-discovery: Navigate to discovery view and wait for grants table', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('[data-view="discovery"]');
  await page.waitForSelector('.grants-table', { timeout: 10000 });
  const rows = await page.locator('.grants-row:not(.header)').count();
  console.log('Grant rows found:', rows);
  expect(rows).toBeGreaterThan(0);
});
