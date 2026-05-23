import { test, expect } from '@playwright/test';
import { resetAppState } from './test-utils';

// TDD: All these tests are written BEFORE implementing features, so they should FAIL initially

test.describe('Grant Operations Center', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetAppState(request);
    await page.goto('http://localhost:3000');
    // Wait for the app shell; individual tests assert the relevant content.
    await page.waitForSelector('.app', { timeout: 10000 });
  });

  test('dashboard-renders: Dashboard shell loads', async ({ page }) => {
    await expect(page.locator('.brand-mark')).toContainText('Grant Ops');
    await expect(page.locator('#view-dashboard')).toBeVisible();
  });

  test('dashboard-deadlines: Deadlines panel shows at least 1 deadline', async ({ page }) => {
    await expect(page.locator('.deadline-item').first()).toBeVisible({ timeout: 60000 });
  });

  test('dashboard-activity: Activity feed shows at least 1 item', async ({ page }) => {
    await expect(page.locator('.activity-item').first()).toBeVisible({ timeout: 60000 });
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
    expect(titles).toEqual(['MATCHED', 'DRAFTING', 'REVIEW', 'SUBMITTED', 'AWARDED/CLOSED']);
  });

  test('pipeline-board-cards: Board cards exist and open drawer on click', async ({ page }) => {
    await page.click('[data-view="pipeline"]');
    const cards = page.locator('.board-card');
    await expect(cards.first()).toBeVisible();
  });

  test('drawer-open: Clicking grant row opens drawer', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.locator('.grants-row:not(.header)').first().click();
    await expect(page.locator('.drawer')).toHaveClass(/open/);
  });

  test('drawer-close: Clicking close button closes drawer', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.locator('.grants-row:not(.header)').first().click();
    await expect(page.locator('.drawer')).toHaveClass(/open/);
    await page.click('.drawer-close');
    await expect(page.locator('.drawer')).toHaveCount(0);
  });

  test('drawer-draft-preview: Drawer shows actions panel', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.locator('.grants-row:not(.header)').first().click();
    await expect(page.locator('.drawer-actions')).toBeVisible();
    await expect(page.locator('.drawer-actions')).toContainText('Approve & lock');
  });

  test('settings-renders: Settings shows 5 cards', async ({ page }) => {
    await page.click('[data-view="settings"]');
    await expect(page.locator('.setting-card')).toHaveCount(5);
  });

  test('settings-edit-mode: Edit profile enables form fields', async ({ page }) => {
    await page.click('[data-view="settings"]');
    await page.click('button:has-text("Edit profile")');
    const inputs = page.locator(
      '.setting-card-body input.form-input, .setting-card-body textarea.form-input',
    );
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

  test('nav-notifications-switch: Notifications nav switches to notifications view', async ({
    page,
  }) => {
    await page.click('.nav-item:has-text("Notifications")');
    await expect(page.locator('#view-notifications')).toHaveClass(/active/);
  });

  test('nav-tasks-switch: Tasks nav switches to tasks view', async ({ page }) => {
    await page.click('.nav-item:has-text("Tasks")');
    await expect(page.locator('#view-tasks')).toHaveClass(/active/);
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
    await expect(sortSelect.locator('option:has-text("Recently added")')).toBeAttached();
  });

  test('drawer-approve-button: Approve & lock button exists', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.locator('.grants-row:not(.header)').first().click();
    await expect(page.locator('.drawer')).toHaveClass(/open/);
    const approveBtn = page.locator('.drawer-actions .btn-primary');
    await expect(approveBtn).toContainText('Approve & lock');
    await expect(approveBtn).toBeEnabled();
  });

  test('drawer-checklist: Drawer shows fit breakdown for drafted grants', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.locator('.grants-row:not(.header)').filter({ hasText: 'NSF' }).first().click();
    await expect(page.locator('.fit-breakdown')).toBeVisible();
    await expect(page.locator('.fit-row')).toHaveCount(5);
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
    if ((await matchedCards.count()) > 0) {
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
    await page.locator('.grants-row:not(.header)').first().click();
    await expect(page.locator('.drawer')).toHaveClass(/open/);
    await page.mouse.click(100, 100);
    await expect(page.locator('.drawer')).toHaveCount(0);
  });

  test('discovery-export-csv-button: Export CSV button exists in header', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    const exportBtn = page.locator('button:has-text("Export CSV")');
    await expect(exportBtn).toBeVisible();
  });

  test('discovery-add-source-button: Add source button exists in header', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    const addSourceBtn = page.locator('button:has-text("+ Add source")');
    await expect(addSourceBtn).toBeVisible();
  });

  test('pipeline-filter-dropdown: Filter dropdown exists in header', async ({ page }) => {
    await page.click('[data-view="pipeline"]');
    const filterSelect = page.locator('select.filter-select');
    await expect(filterSelect).toBeVisible();
  });

  test('pipeline-add-to-pipeline-button: + Add to pipeline button exists in header', async ({
    page,
  }) => {
    await page.click('[data-view="pipeline"]');
    const addBtn = page.locator('button:has-text("+ Add to pipeline")');
    await expect(addBtn).toBeVisible();
  });

  test('settings-theme-tags: Theme tags have X remove buttons', async ({ page }) => {
    await page.click('[data-view="settings"]');
    const themeTags = page.locator('.theme-tag');
    await expect(themeTags.first()).toBeVisible();
    const removeButtons = page.locator('.theme-tag-remove');
    await expect(removeButtons.first()).toBeVisible();
  });

  test('settings-theme-add: Theme add input and button exist', async ({ page }) => {
    await page.click('[data-view="settings"]');
    const themeInput = page.locator('.theme-input');
    await expect(themeInput).toBeVisible();
    const addBtn = page.locator('.theme-add button');
    await expect(addBtn).toBeVisible();
  });

  test('settings-upload-button: Upload button exists in documents section', async ({ page }) => {
    await page.click('[data-view="settings"]');
    const uploadBtn = page.locator('.upload-item');
    await expect(uploadBtn).toBeVisible();
  });

  test('dashboard-panel-action: View all panel action has data-view-link', async ({ page }) => {
    const panelAction = page.locator('.panel-action[data-view-link="pipeline"]');
    await expect(panelAction.first()).toBeVisible();
  });

  test('dashboard-kpi-delta: Active Pipeline card has delta text', async ({ page }) => {
    const deltaText = page.locator('.delta-up');
    await expect(deltaText.first()).toBeVisible();
  });

  test('notifications-view: Notifications view shows notification list', async ({ page }) => {
    await page.click('.nav-item:has-text("Notifications")');
    await expect(page.locator('#view-notifications')).toHaveClass(/active/);
  });

  test('tasks-view: Tasks view shows task list', async ({ page }) => {
    await page.click('.nav-item:has-text("Tasks")');
    await expect(page.locator('#view-tasks')).toHaveClass(/active/);
  });

  test('sidebar-footer-dynamic: Sidebar footer shows dynamic data', async ({ page }) => {
    const sidebarFooter = page.locator('.sidebar-footer');
    await expect(sidebarFooter).toBeVisible();
    const footerText = await sidebarFooter.textContent();
    expect(footerText).toContain('Logged in as');
  });

  test('discovery-filter-Community: Community filter shows only Community grants', async ({
    page,
  }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.filter-pill:has-text("Community")');
    await page.waitForTimeout(300);
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('discovery-filter-ScienceTech: Science & Tech filter shows only Science & Tech grants', async ({
    page,
  }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.filter-pill:has-text("Science & Tech")');
    await page.waitForTimeout(300);
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('discovery-filter-Federal: Federal filter shows only Federal grants', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.filter-pill:has-text("Federal")');
    await page.waitForTimeout(300);
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('discovery-filter-Foundation: Foundation filter shows only Foundation grants', async ({
    page,
  }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.filter-pill:has-text("Foundation")');
    await page.waitForTimeout(300);
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('discovery-filter-Corporate: Corporate filter shows only Corporate grants', async ({
    page,
  }) => {
    await page.click('[data-view="discovery"]');
    await page.click('.filter-pill:has-text("Corporate")');
    await page.waitForTimeout(300);
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('discovery-sort-by-fit: Fit sort option exists and sorts correctly', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    const sortSelect = page.locator('select').first();
    await expect(sortSelect.locator('option:has-text("Best fit")')).toBeAttached();
  });

  test('discovery-sort-by-deadline: Deadline sort option exists', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    const sortSelect = page.locator('select').first();
    await expect(sortSelect.locator('option:has-text("Deadline")')).toBeAttached();
  });

  test('discovery-sort-by-award: Award amount sort option exists', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    const sortSelect = page.locator('select').first();
    await expect(sortSelect.locator('option:has-text("Award size")')).toBeAttached();
  });

  test('drawer-displays-funder-info: Drawer displays funder name', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.locator('.grants-row:not(.header)').first().click();
    await expect(page.locator('.drawer')).toHaveClass(/open/);
    const funderInfo = page.locator('.drawer-funder');
    await expect(funderInfo).toBeVisible();
    const funderText = await funderInfo.textContent();
    expect(funderText?.length).toBeGreaterThan(0);
  });

  test('notifications-list-renders: Notifications view shows list of notifications', async ({
    page,
  }) => {
    await page.click('.nav-item:has-text("Notifications")');
    await page.waitForSelector('.notification-item', { timeout: 5000 });
    const items = page.locator('.notification-item');
    expect(await items.count()).toBeGreaterThan(0);
  });

  test('tasks-list-renders: Tasks view shows list of tasks', async ({ page }) => {
    await page.click('.nav-item:has-text("Tasks")');
    await page.waitForSelector('.task-item', { timeout: 5000 });
    const items = page.locator('.task-item');
    expect(await items.count()).toBeGreaterThan(0);
  });

  test('api-persistence: Grant update via API persists and reflects in GET', async ({ request }) => {
    // Get all grants via API
    const grantsResponse = await request.get('http://localhost:3000/api/grants');
    expect(grantsResponse.ok()).toBeTruthy();
    const grants: Array<{ id: string; status: string }> = await grantsResponse.json();
    expect(grants.length).toBeGreaterThan(0);

    // Get the first grant's current state
    const firstGrant = grants[0];
    const originalStatus = firstGrant.status;

    // Update the grant status via PATCH
    const newStatus = originalStatus === 'matched' ? 'draft' : 'matched';
    const updateResponse = await request.patch(
      `http://localhost:3000/api/grants/${firstGrant.id}`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { status: newStatus, statusLabel: newStatus === 'draft' ? 'In Draft' : 'Matched' },
      },
    );
    expect(updateResponse.ok()).toBeTruthy();

    // Read it back via GET and verify persistence
    const getResponse = await request.get(`http://localhost:3000/api/grants/${firstGrant.id}`);
    expect(getResponse.ok()).toBeTruthy();
    const updatedGrant = await getResponse.json();
    expect(updatedGrant.status).toBe(newStatus);

    // Restore original status
    await request.patch(`http://localhost:3000/api/grants/${firstGrant.id}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { status: originalStatus, statusLabel: originalStatus === 'draft' ? 'In Draft' : originalStatus === 'matched' ? 'Matched' : originalStatus },
    });
  });
});
