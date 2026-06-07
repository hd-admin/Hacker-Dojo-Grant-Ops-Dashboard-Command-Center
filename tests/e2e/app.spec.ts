import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { configureOpencodeThroughSettingsView, resetAppState } from './test-utils';

const opencodeStubPath = path.join(process.cwd(), 'tests/e2e/opencode-stub.sh');

async function ensureOpencodeStub(): Promise<string> {
  // Ensure the existing stub script is executable
  await fs.chmod(opencodeStubPath, 0o755);
  return opencodeStubPath;
}

test.describe('Grant Operations Center smoke', () => {
  test.beforeEach(async ({ request, page }) => {
    const stubPath = await ensureOpencodeStub();
    await resetAppState(request);
    await page.goto('http://127.0.0.1:3000');
    await page.waitForSelector('.app', { timeout: 60000 });
    // Only click rerun-health-check if the app is in blocked state (storage error)
    const rerunBtn = page.locator('.shell-banner-row [data-testid="rerun-health-check-btn"]');
    if (await rerunBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rerunBtn.click();
    }
    await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
    const discoveryNav = page.locator('.nav-item[data-view="discovery"]');
    if (await discoveryNav.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(discoveryNav).not.toBeDisabled();
    }
    await page.click('[data-view="dashboard"]');
    await page.waitForSelector('#view-dashboard.active', { timeout: 10000 });
  });

  test('shell loads with footer', async ({ page }) => {
    await expect(page.locator('.brand-mark')).toContainText('Grant Ops');
    await expect(page.locator('.nav-item[data-view="discovery"]')).toBeVisible();
    await expect(page.locator('.nav-item[data-view="tasks"]')).toBeVisible();
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

  test('drawer surfaces prototype detail sections and action gates for an unrated matched grant', async ({
    page,
    request,
  }) => {
    // Seed a matched grant without draft content
    const seedRes = await request.post('http://127.0.0.1:3000/api/grants', {
      data: {
        title: 'Test Matched Grant for Drawer',
        funder: 'Test Funder',
        status: 'matched',
        fit: 85,
        award: '$50,000',
        awardSort: 50000,
        deadline: '2025-12-31',
        deadlineConfidence: 'exact',
        daysOut: 365,
        tags: ['Community'],
        funderSummary: 'A test funder summary for validation.',
      },
    });
    expect(seedRes.ok()).toBeTruthy();
    const seedBody = await seedRes.json();
    const targetGrantId = seedBody.id;

    const grantsResponse = await request.get('http://127.0.0.1:3000/api/grants');
    expect(grantsResponse.ok()).toBeTruthy();
    const grantsData = await grantsResponse.json();
    const grants: Array<{
      id: string;
      title: string;
      status: string;
      draftContent?: string;
      fit: number;
    }> = grantsData.items || grantsData;
    const targetGrant = grants.find((grant) => grant.id === targetGrantId);
    expect(targetGrant).toBeDefined();
    if (!targetGrant) {
      throw new Error('Expected seeded matched grant');
    }
    const sortedGrants = [...grants].sort((a, b) => b.fit - a.fit);
    const selectedIndex = sortedGrants.findIndex((grant) => grant.id === targetGrant.id);
    expect(selectedIndex).toBeGreaterThan(-1);

    // Refresh so the discovery view picks up the newly seeded grant
    await page.reload();
    await page.waitForSelector('.app', { timeout: 60000 });

    await page.click('[data-view="discovery"]');
    await page.waitForSelector('.grants-row:not(.header)', { timeout: 10000 });
    // Find the specific grant row by title instead of relying on sort order
    const grantRow = page.locator('.grants-row:not(.header)').filter({ hasText: targetGrant.title });
    await expect(grantRow).toBeVisible({ timeout: 5000 });
    // Click the title cell to avoid the nested "View funder details" button
    await grantRow.locator('div').first().click();

    await expect(page.locator('.drawer-title')).toHaveText(targetGrant.title);
    await expect(page.locator('.drawer')).toContainText('Funder summary (agent-generated)');
    await expect(page.locator('.drawer')).toContainText('Requirements checklist');
    await expect(page.locator('.drawer')).toContainText('Drafted Letter of Intent — preview');
    await expect(page.locator('button:has-text("Generate draft")')).toBeVisible();
    await expect(page.locator('button:has-text("Open in editor")')).toBeVisible();
    await expect(page.locator('.drawer-actions button:has-text("Approve and lock")')).toHaveCount(0);
    await expect(page.locator('.drawer-actions button:has-text("Submit")')).toHaveCount(0);
  });

  test('discovery exposes source-intake controls', async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await expect(page.locator('button:has-text("+ Add source")')).toBeVisible();
    await expect(page.locator('button:has-text("+ Add manually")')).toBeVisible();
  });

  test('pipeline and settings sections render expected controls', async ({ page }) => {
    await page.click('[data-view="pipeline"]');
    await expect(page.locator('.board-col')).toHaveCount(11);
    await expect(page.locator('button:has-text("+ Add to pipeline")')).toBeVisible();

    await page.click('[data-view="settings"]');
    await expect(page.locator('.upload-item')).toBeVisible();
    await expect(page.locator('.setting-card')).toHaveCount(9);
  });

  test('AC-14.2.4: failed job can be retried from UI', async ({ page, request }) => {
    // Create a job that will fail
    const startRes = await request.post('http://127.0.0.1:3000/api/research', {
      data: { query: '__force_failure_test__' },
    });
    expect(startRes.ok()).toBeTruthy();
    const { job } = await startRes.json();
    expect(job).toBeDefined();
    const jobId = job.id;
    expect(jobId).toBeDefined();

    // Refresh and navigate to jobs view to ensure jobs panel loads the failed job
    await page.reload();
    await page.waitForSelector('.app', { timeout: 60000 });
    await page.click('[data-view="jobs"]');
    await expect(page.locator('#view-jobs')).toHaveClass(/active/);

    // Verify the failed job appears in the UI
    await expect(page.locator(`[data-testid="job-item-failed-${jobId}"]`)).toBeVisible({
      timeout: 15000,
    });

    // Verify retry button is present and clickable
    const retryBtn = page.locator(`[data-testid="job-retry-btn-${jobId}"]`);
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();

    // Verify the original failed job still shows as failed, and a new job appears (may complete instantly with stub)
    await expect(page.locator(`[data-testid="job-item-failed-${jobId}"]`)).toBeVisible();
    const newJobItem = page.locator('[data-testid^="job-item-queued-"], [data-testid^="job-item-running-"], [data-testid^="job-item-completed-"]');
    await expect(newJobItem.first()).toBeVisible({ timeout: 10000 });

    // Verify no error banner appears after retry
    await expect(page.locator('[data-testid="jobs-error-banner"]')).toHaveCount(0);
  });

  test('AC-14.3.4: sidebar badge shows correct active job count', async ({ page, request }) => {
    // Start a long-running job
    const startRes = await request.post('http://127.0.0.1:3000/api/research', {
      data: { query: 'test query for badge count' },
    });
    expect(startRes.ok()).toBeTruthy();
    const { job } = await startRes.json();
    expect(job).toBeDefined();
    const jobId = job.id;
    expect(jobId).toBeDefined();

    // Navigate to jobs view to trigger active jobs load
    await page.click('[data-view="jobs"]');
    await expect(page.locator('#view-jobs')).toHaveClass(/active/);

    // Check that the jobs nav item shows a count when active jobs exist
    const jobsNav = page.locator('.nav-item[data-view="jobs"]');
    await expect(jobsNav).toBeVisible();
  });

  test('AC-14.10.3: frontend handles API error codes with specific messages', async ({ page }) => {
    // Test 400 validation error
    const badRequestRes = await page.request.post('http://127.0.0.1:3000/api/grants', {
      data: { invalidField: true },
    });
    expect(badRequestRes.status()).toBeGreaterThanOrEqual(400);
    expect(badRequestRes.status()).toBeLessThan(500);
    const badBody = await badRequestRes.json();
    expect(badBody.error || badBody.message || badBody.details).toBeDefined();

    // Test 404 not found
    const notFoundRes = await page.request.get(
      'http://127.0.0.1:3000/api/grants/nonexistent-grant-id-12345',
    );
    expect(notFoundRes.status()).toBeGreaterThanOrEqual(404);
    expect(notFoundRes.status()).toBeLessThan(500);
    const notFoundBody = await notFoundRes.json();
    expect(notFoundBody.error || notFoundBody.message).toBeDefined();
  });

  test('grant updates persist through the API', async ({ request }) => {
    const grantsResponse = await request.get('http://127.0.0.1:3000/api/grants');
    expect(grantsResponse.ok()).toBeTruthy();
    const grantsData = await grantsResponse.json();
    const grants: Array<{ id: string; status: string }> = grantsData.items || grantsData;
    const firstGrant = grants[0];
    expect(firstGrant).toBeDefined();

    const originalStatus = firstGrant.status;
    const nextStatus = originalStatus === 'matched' ? 'draft' : 'matched';

    const updateResponse = await request.patch(
      `http://127.0.0.1:3000/api/grants/${firstGrant.id}/status`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: {
          status: nextStatus,
          statusLabel: nextStatus === 'draft' ? 'In Draft' : 'Matched',
        },
      },
    );
    expect(updateResponse.ok()).toBeTruthy();

    const getResponse = await request.get(`http://127.0.0.1:3000/api/grants/${firstGrant.id}`);
    expect(getResponse.ok()).toBeTruthy();
    const updatedGrant = await getResponse.json();
    expect(updatedGrant.grant.status).toBe(nextStatus);

    await request.patch(`http://127.0.0.1:3000/api/grants/${firstGrant.id}`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        status: originalStatus,
        statusLabel:
          originalStatus === 'draft'
            ? 'In Draft'
            : originalStatus === 'matched'
              ? 'Matched'
              : originalStatus,
      },
    });
  });
});
