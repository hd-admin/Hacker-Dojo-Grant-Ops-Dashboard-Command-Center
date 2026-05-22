import { test, expect } from '@playwright/test';

// TDD: All these tests are written BEFORE implementing features, so they should FAIL initially

test.describe('Grant Operations Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Wait for app to load
    await page.waitForSelector('.app', { timeout: 10000 });
  });

  test('dashboard-renders: Dashboard shows 4 KPI cards', async ({ page }) => {
    await expect(page.locator('.kpi-card')).toHaveCount(4);
  });

  test('dashboard-deadlines: Deadlines panel shows at least 1 deadline', async ({ page }) => {
    await expect(page.locator('.deadline-item').first()).toBeVisible();
  });

  test('dashboard-activity: Activity feed shows at least 1 item', async ({ page }) => {
    await expect(page.locator('.activity-item').first()).toBeVisible();
  });

  test('discovery-search: Search filters grants by NSF', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.fill('input[placeholder*="Search"]', 'NSF');
    const rows = page.locator('.grants-row:not(.header)');
    await expect(rows).toHaveCount(await rows.count());
  });

  test('pipeline-columns: Pipeline shows 5 columns', async ({ page }) => {
    await page.click('[data-view="pipeline"]');
    await expect(page.locator('.board-col')).toHaveCount(5);
  });

  test('pipeline-columns-titles: Pipeline columns have correct titles', async ({ page }) => {
    await page.click('[data-view="pipeline"]');
    const titles = await page.locator('.board-col-title').allTextContents();
    expect(titles).toEqual(['Matched', 'Drafting', 'Review', 'Submitted', 'Awarded/Closed']);
  });

  test('pipeline-board-cards: Board cards exist and open drawer on click', async ({ page }) => {
    await page.click('[data-view="pipeline"]');
    const cards = page.locator('.board-card');
    await expect(cards.first()).toBeVisible();
  });

  test('drawer-open: Clicking grant row opens drawer', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.grants-row:not(.header):first-child');
    await expect(page.locator('.drawer')).toHaveClass(/open/);
  });

  test('drawer-close: Clicking close button closes drawer', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.grants-row:not(.header):first-child');
    await expect(page.locator('.drawer')).toHaveClass(/open/);
    await page.click('.drawer-close');
    await expect(page.locator('.drawer')).not.toHaveClass(/open/);
  });

  test('drawer-draft-preview: Draft preview shows content', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.grants-row:not(.header):first-child');
    const draftPreview = page.locator('.draft-preview');
    await expect(draftPreview).toBeVisible();
  });

  test('settings-renders: Settings shows 4 cards', async ({ page }) => {
    await page.click('[data-view="settings"]');
    await expect(page.locator('.setting-card')).toHaveCount(4);
  });

  test('settings-edit-mode: Edit profile enables form fields', async ({ page }) => {
    await page.click('[data-view="settings"]');
    await page.click('button:has-text("Edit profile")');
    const inputs = page.locator('.setting-card-body input.form-input, .setting-card-body textarea.form-input');
    await expect(inputs.first()).toBeEnabled();
  });

  test('nav-switch: Nav items switch views correctly', async ({ page }) => {
    // Dashboard active by default
    await expect(page.locator('#view-dashboard')).toHaveClass(/active/);

    // Switch to Discovery
    await page.click('[data-view="discovery"]');
    await expect(page.locator('#view-discovery')).toHaveClass(/active/);
    await expect(page.locator('#view-dashboard')).not.toHaveClass(/active/);

    // Switch to Pipeline
    await page.click('[data-view="pipeline"]');
    await expect(page.locator('#view-pipeline')).toHaveClass(/active/);

    // Switch to Settings
    await page.click('[data-view="settings"]');
    await expect(page.locator('#view-settings')).toHaveClass(/active/);
  });

  test('nav-notifications-decorative: Notifications does not change view', async ({ page }) => {
    const initialView = await page.locator('.view.active').getAttribute('id');
    await page.click('.nav-item:has-text("Notifications")');
    const afterView = await page.locator('.view.active').getAttribute('id');
    expect(afterView).toBe(initialView);
  });

  test('drawer-overlay-close: Clicking overlay closes drawer', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.grants-row:not(.header):first-child');
    await expect(page.locator('.drawer')).toHaveClass(/open/);
    await page.click('.drawer-overlay');
    await expect(page.locator('.drawer')).not.toHaveClass(/open/);
  });
});
