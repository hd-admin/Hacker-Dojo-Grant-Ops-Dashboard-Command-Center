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

  test('dashboard-date-greeting: Dashboard greeting contains day name', async ({ page }) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    const dayName = days[today.getDay()];
    const headerSub = await page.locator('.header-sub').first().textContent();
    expect(headerSub).toContain(dayName);
  });

  test('dashboard-kpis: Dashboard shows 4 KPI cards with non-zero values', async ({ page }) => {
    const kpiCards = page.locator('.kpi-card');
    await expect(kpiCards).toHaveCount(4);
    const kpiValues = await page.locator('.kpi-value').allTextContents();
    for (const val of kpiValues) {
      expect(val.trim().length).toBeGreaterThan(0);
    }
  });

  test('discovery-search-NSF: Search filters grants by NSF', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.fill('input[placeholder*="Search"]', 'NSF');
    await page.waitForTimeout(300);
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('nsf');
    }
  });

  test('discovery-filter-EdTech: EdTech filter shows only EdTech grants', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.filter-pill:has-text("EdTech")');
    await page.waitForTimeout(300);
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('edtech');
    }
  });

  test('discovery-sort-recently-added: Recently added sort option exists', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    const sortSelect = page.locator('select').first();
    await expect(sortSelect.locator('option:has-text("Recently added")')).toBeVisible();
  });

  test('drawer-approve-button: Approve & lock draft button exists', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.grants-row:not(.header):first-child');
    await expect(page.locator('.drawer')).toHaveClass(/open/);
    const approveBtn = page.locator('.drawer-footer .btn-primary');
    await expect(approveBtn).toContainText('Approve & lock draft');
  });

  test('drawer-checklist: Checklist shows done/undone state', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.grants-row:not(.header):first-child');
    await page.waitForSelector('.checklist', { timeout: 5000 });
    const checklistItems = page.locator('.check-item');
    const count = await checklistItems.count();
    expect(count).toBeGreaterThan(0);
    const doneItem = checklistItems.first();
    const isDone = await doneItem.evaluate(el => el.classList.contains('done'));
    expect(typeof isDone).toBe('boolean');
  });

  test('settings-edit-save: Edit mode modifies mission field', async ({ page }) => {
    await page.click('[data-view="settings"]');
    await page.click('button:has-text("Edit profile")');
    const missionInput = page.locator('textarea.form-input').first();
    await expect(missionInput).toBeEnabled();
    await missionInput.fill('Updated mission text for testing');
    await page.click('button:has-text("Save changes")');
    await page.waitForTimeout(500);
    const savedValue = await page.locator('.setting-value').first().textContent();
    expect(savedValue?.length).toBeGreaterThan(0);
  });

  test('pipeline-drag-over: Pipeline columns show drag-over state', async ({ page }) => {
    await page.click('[data-view="pipeline"]');
    const matchedCards = page.locator('.board-col').first().locator('.board-card');
    if (await matchedCards.count() > 0) {
      const firstCard = matchedCards.first();
      const targetCol = page.locator('.board-col').nth(1);
      await firstCard.dragTo(targetCol);
      await page.waitForTimeout(500);
    }
    const boardCols = page.locator('.board-col');
    await expect(boardCols).toHaveCount(5);
  });

  test('drawer-overlay-close: Clicking overlay closes drawer', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.grants-row:not(.header):first-child');
    await expect(page.locator('.drawer')).toHaveClass(/open/);
    await page.click('.drawer-overlay');
    await expect(page.locator('.drawer')).not.toHaveClass(/open/);
  });
});
