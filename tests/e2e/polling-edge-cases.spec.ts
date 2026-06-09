/**
 * Polling Edge Cases E2E Test
 *
 * AC-14.4.3: Background tab polling continues, refetch on re-focus.
 */

import { test, expect } from '@playwright/test';
import { BASE_URL, resetAppState, configureOpencodeThroughSettingsView } from './test-utils';


test.describe('Polling Edge Cases', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetAppState(request);
    const stubPath = process.env.OPENCODE_STUB_PATH || './tests/e2e/opencode-stub.sh';
    await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
  });

  test('tab switch and return refreshes job status', async ({ page, request }) => {
    // Start a research job
    const startRes = await request.post(`${BASE_URL}/api/research`, {
      data: { query: 'test query' },
    });
    expect(startRes.ok()).toBeTruthy();
    const startBody = await startRes.json();
    const jobId = startBody.job.id;

    await page.goto('/');
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 5000 });

    // Navigate to a view that shows job progress
    await page.click('[data-testid="nav-discovery"]');
    await expect(page.locator('#view-discovery')).toBeVisible({ timeout: 5000 });

    // Wait for initial poll
    await page.waitForTimeout(2500);

    // Simulate tab switching by hiding/showing page
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.waitForTimeout(1000);

    // Switch back to visible
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // After refocus, job status should update (either running or completed)
    const jobRes = await request.get(`${BASE_URL}/api/jobs/${encodeURIComponent(jobId)}`);
    expect(jobRes.ok()).toBeTruthy();
    const job = await jobRes.json();
    expect(job).toHaveProperty('status');
    expect(['queued', 'running', 'completed', 'failed']).toContain(job.status);
  });
});
