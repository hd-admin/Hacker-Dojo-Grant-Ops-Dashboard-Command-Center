import { expect, test } from '@playwright/test';
import { resetAppState } from './test-utils';

test.describe('Grant Operations Center smoke', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetAppState(request);
    await page.goto('http://localhost:3000');
    await page.waitForSelector('.app', { timeout: 10000 });
  });

  test('shell loads with nav badges and footer', async ({ page }) => {
    await expect(page.locator('.brand-mark')).toContainText('Grant Ops');
    await expect(page.locator('.nav-item[data-view="discovery"] .nav-count')).toBeVisible();
    await expect(page.locator('.nav-item[data-view="tasks"] .nav-count')).toBeVisible();
    await expect(page.locator('.sidebar-footer')).toContainText('Logged in as');
  });

  test('navigation switches between core views', async ({ page }) => {
    await expect(page.locator('#view-dashboard')).toHaveClass(/active/);

    await page.click('[data-view="discovery"]');
    await expect(page.locator('#view-discovery')).toHaveClass(/active/);

    await page.click('[data-view="pipeline"]');
    await expect(page.locator('#view-pipeline')).toHaveClass(/active/);

    await page.click('[data-view="settings"]');
    await expect(page.locator('#view-settings')).toHaveClass(/active/);
  });

  test('discovery exposes source-intake controls', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await expect(page.locator('button:has-text("+ Add source")')).toBeVisible();
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible();
  });

  test('pipeline and settings sections render expected controls', async ({ page }) => {
    await page.click('[data-view="pipeline"]');
    await expect(page.locator('.board-col')).toHaveCount(5);
    await expect(page.locator('button:has-text("+ Add to pipeline")')).toBeVisible();

    await page.click('[data-view="settings"]');
    await expect(page.locator('.upload-item')).toBeVisible();
    await expect(page.locator('.setting-card')).toHaveCount(5);
  });

  test('grant updates persist through the API', async ({ request }) => {
    const grantsResponse = await request.get('http://localhost:3000/api/grants');
    expect(grantsResponse.ok()).toBeTruthy();
    const grants: Array<{ id: string; status: string }> = await grantsResponse.json();
    const firstGrant = grants[0];
    expect(firstGrant).toBeDefined();

    const originalStatus = firstGrant.status;
    const nextStatus = originalStatus === 'matched' ? 'draft' : 'matched';

    const updateResponse = await request.patch(`http://localhost:3000/api/grants/${firstGrant.id}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { status: nextStatus, statusLabel: nextStatus === 'draft' ? 'In Draft' : 'Matched' },
    });
    expect(updateResponse.ok()).toBeTruthy();

    const getResponse = await request.get(`http://localhost:3000/api/grants/${firstGrant.id}`);
    expect(getResponse.ok()).toBeTruthy();
    const updatedGrant = await getResponse.json();
    expect(updatedGrant.status).toBe(nextStatus);

    await request.patch(`http://localhost:3000/api/grants/${firstGrant.id}`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        status: originalStatus,
        statusLabel: originalStatus === 'draft' ? 'In Draft' : originalStatus === 'matched' ? 'Matched' : originalStatus,
      },
    });
  });
});
