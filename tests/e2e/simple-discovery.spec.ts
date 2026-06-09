import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { BASE_URL,
  configureOpencodeThroughSettingsView,
  resetAppState,
  saveProfileThroughSettingsView,
  uploadDocumentThroughSettingsView,
} from './test-utils';

const opencodeStubPath = path.join(process.cwd(), 'tests/e2e/opencode-stub.sh');

async function ensureOpencodeStub(): Promise<string> {
  // The opencode-stub.sh is the maintained stub that handles all job types.
  // We set up the symlink (opencode -> opencode-stub.sh) for PATH resolution.
  const opencodeLink = path.join(path.dirname(opencodeStubPath), 'opencode');
  try {
    await fs.symlink(opencodeStubPath, opencodeLink);
  } catch {
    // Symlink may already exist
  }
  return opencodeStubPath;
}

test('simple-discovery: add source and refresh crawl state', async ({ request, page }) => {
  const stubPath = await ensureOpencodeStub();
  await resetAppState(request);
  await page.goto(BASE_URL);
  await page.waitForSelector('.app', { timeout: 60000 });

  await saveProfileThroughSettingsView(
    page,
    'Community innovation and education with maker pathways.',
  );
  await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
  await uploadDocumentThroughSettingsView(
    page,
    'tests/fixtures/documents/hacker-dojo-program-summary.pdf',
  );

  // Verify opencode is configured via health check
  const healthResponse = await request.get(`/api/health`);
  expect(healthResponse.ok()).toBeTruthy();
  const healthData = (await healthResponse.json()) as { opencode: string };
  expect(healthData.opencode).toBe('ok');

  await page.click('[data-view="settings"]');
  await page.waitForSelector('#view-settings.active', { timeout: 10000 });
  await expect(page.locator('#view-settings .header-title')).toContainText('Org Profile');

  await page.click('[data-view="discovery"]');
  await expect(page.locator('#view-discovery')).toHaveClass(/active/);

  await expect(page.locator("button:has-text('+ Add source')")).toBeVisible();
  await expect(page.locator('.sidebar-footer')).toContainText('Logged in as');

  await page.getByRole('button', { name: '+ Add source' }).click();
  await page.locator('input[placeholder="Source name"]').fill('Candid');
  await page.locator('input[placeholder="https://..."]').fill('https://www.candid.org');
  const addSourceResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/sources') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const sourceResponse = await addSourceResponse;
  expect(sourceResponse.ok()).toBeTruthy();

  // Manually trigger research since adding a source no longer auto-triggers it
  const researchResponse = await request.post(`/api/research`, {
    data: { query: 'Candid' },
  });
  expect(researchResponse.ok()).toBeTruthy();

  await expect(page.locator('.source-item')).toHaveCount(1);
  await expect(page.locator('.source-item .source-name')).toContainText('Candid');

  const sourcesResponse = await request.get(`/api/sources`);
  expect(sourcesResponse.ok()).toBeTruthy();
  const sources = (await sourcesResponse.json()) as Array<{
    name: string;
    url: string;
  }>;
  expect(
    sources.some((source) => source.name === 'Candid' && source.url === 'https://www.candid.org'),
  ).toBe(true);

  let research = null as {
    latestRun: { status: string; sourcesCrawled: number } | null;
  } | null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const researchResponse = await request.get(`/api/research`);
    expect(researchResponse.ok()).toBeTruthy();
    research = (await researchResponse.json()) as typeof research;
    if (research.latestRun?.status === 'completed' && research.latestRun.sourcesCrawled > 0) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  expect(research?.latestRun?.status).toBe('completed');
  expect(research?.latestRun?.sourcesCrawled).toBeGreaterThan(0);

  // Crawl status subtitle check
  await page.click('[data-view="discovery"]');
  await expect(page.locator('#view-discovery .header-sub')).toContainText('crawled');

  await expect(page.locator('.sidebar-footer')).toContainText('Crawler');
});
