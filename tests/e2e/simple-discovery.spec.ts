import { test, expect } from '@playwright/test';
import { defaultProfile } from '../../shared/seed-data';
import { resetAppState } from './test-utils';

test('simple-discovery: add source and refresh crawl state', async ({ request, page }) => {
  await resetAppState(request);
  await request.put('http://localhost:3000/api/profile', { data: defaultProfile });
  await request.put('http://localhost:3000/api/opencode-settings', {
    data: {
      binaryPath: '/usr/local/bin/opencode',
      workingDirectory: '/Users/mistlight/Projects/Experiments/HackerDojoGrantApp',
      timeoutMs: 60000,
      profile: 'default',
      isConfigured: true,
    },
  });
  await page.goto('http://localhost:3000');
  await page.waitForSelector('.app', { timeout: 10000 });

  await page.click('[data-view="discovery"]');
  await expect(page.locator('.grants-table')).toBeVisible();

  const sourceButton = page.locator('button:has-text("+ Add source")');
  await expect(sourceButton).toBeVisible();
  await sourceButton.click();

  await page.fill('input[placeholder="Source name"]', 'Candid');
  await page.fill('input[placeholder="https://..."]', 'https://www.candid.org');

  await page.click('button[type="submit"]');

  await expect(page.locator('button:has-text("+ Add source")')).toBeVisible();
  await expect(page.locator('.sidebar-footer')).toContainText('Logged in as');

  const sourcesResponse = await request.get('http://localhost:3000/api/sources');
  expect(sourcesResponse.ok()).toBeTruthy();
  const sources = (await sourcesResponse.json()) as Array<{ name: string; url: string }>;
  expect(sources.some((source) => source.name === 'Candid' && source.url === 'https://www.candid.org')).toBe(true);

  const researchResponse = await request.get('http://localhost:3000/api/research');
  expect(researchResponse.ok()).toBeTruthy();
  const research = await researchResponse.json() as { latestRun: { status: string; sourcesCrawled: number } | null };
  expect(research.latestRun?.status).toBe('completed');
  expect(research.latestRun?.sourcesCrawled).toBeGreaterThan(0);

  await expect(page.locator('.sidebar-footer')).toContainText('Crawler');
});
