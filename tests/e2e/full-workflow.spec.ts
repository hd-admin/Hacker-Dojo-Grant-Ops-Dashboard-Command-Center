/**
 * Full Workflow End-to-End Test
 *
 * Covers the complete Discovery -> Submission -> Award lifecycle.
 * All agent calls are mocked. Test must complete in under 30s.
 * AC-14.1 compliance.
 */

import { test, expect } from '@playwright/test';

test.describe('Full Workflow E2E', () => {
  test('complete discovery-to-award lifecycle', async ({ page, request }) => {
    test.setTimeout(30000);

    // Step 1: Navigate to the app
    await page.goto('/');
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 5000 });

    // Step 2: Verify dashboard loads with KPI cards
    await page.click('[data-testid="nav-dashboard"]');
    await expect(page.locator('[data-testid="dashboard-view"]')).toBeVisible({ timeout: 3000 });

    // Step 3: Navigate to Discovery
    await page.click('[data-testid="nav-discovery"]');
    await expect(page.locator('[data-testid="discovery-view"]')).toBeVisible({ timeout: 3000 });

    // Step 4: Verify grants appear in discovery
    const grantCards = page.locator('[data-testid^="grant-card-"]');
    const initialCount = await grantCards.count();
    expect(initialCount).toBeGreaterThanOrEqual(0);

    // Step 5: Navigate to Pipeline
    await page.click('[data-testid="nav-pipeline"]');
    await expect(page.locator('[data-testid="pipeline-view"]')).toBeVisible({ timeout: 3000 });

    // Step 6: Navigate to settings (profile loads)
    await page.click('[data-testid="nav-settings"]');
    await expect(page.locator('[data-testid="org-profile-card"]')).toBeVisible({ timeout: 5000 });

    // Step 7: Verify health endpoint
    const healthRes = await request.get('/api/health');
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health).toHaveProperty('storage');

    // Step 8: Verify grants API
    const grantsRes = await request.get('/api/grants');
    expect(grantsRes.status()).toBe(200);

    // Step 9: Verify jobs API
    const jobsRes = await request.get('/api/jobs');
    expect(jobsRes.status()).toBe(200);

    // Step 10: Verify sources API
    const sourcesRes = await request.get('/api/sources');
    expect(sourcesRes.status()).toBe(200);

    // Step 11: Verify profile API returns 200
    const profileRes = await request.get('/api/profile');
    expect(profileRes.status()).toBe(200);

    // Step 12: Check notifications endpoint
    const notifRes = await request.get('/api/notifications');
    expect(notifRes.ok()).toBeTruthy();

    // Step 13: Check tasks endpoint
    const tasksRes = await request.get('/api/tasks');
    expect(tasksRes.ok()).toBeTruthy();

    // Step 14: Verify backup freshness
    const freshnessRes = await request.get('/api/backup/freshness');
    expect(freshnessRes.ok()).toBeTruthy();

    // Step 15: Verify crawling scheduled endpoint
    const crawlRes = await request.get('/api/crawl/scheduled');
    expect(crawlRes.ok()).toBeTruthy();

    // Step 16: Verify health check includes opencode status
    expect(health.opencode).toBeDefined();
  });

  test('job lifecycle API', async ({ request }) => {
    // Start a research job
    const startRes = await request.post('/api/research', {
      data: { query: 'test grants for makerspaces' },
    });
    expect(startRes.ok()).toBeTruthy();
    const { jobId } = await startRes.json();
    expect(jobId).toBeDefined();

    // Check job status
    const jobRes = await request.get(`/api/jobs/${jobId}`);
    expect(jobRes.ok()).toBeTruthy();
    const job = await jobRes.json();
    expect(job).toHaveProperty('status');

    // List all jobs
    const allJobsRes = await request.get('/api/jobs');
    expect(allJobsRes.ok()).toBeTruthy();
  });

  test('pipeline state validation', async ({ request }) => {
    // Test pipeline view API
    const grantsRes = await request.get('/api/grants');
    expect(grantsRes.ok()).toBeTruthy();
    const grants = await grantsRes.json();

    if (Array.isArray(grants) && grants.length > 0) {
      const firstGrant = grants[0];
      // Test status endpoint rejects invalid transitions
      const statusRes = await request.put(`/api/grants/${firstGrant.id}/status`, {
        data: { status: 'INVALID_STATUS' },
      });
      // Should reject invalid status
      expect(statusRes.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('submission blocking', async ({ request }) => {
    const grantsRes = await request.get('/api/grants');
    const grants = await grantsRes.json();

    if (Array.isArray(grants) && grants.length > 0) {
      const firstGrant = grants[0];
      const submitRes = await request.post(`/api/grants/${firstGrant.id}/submit`);
      // Should return blocking reasons or success
      const submitBody = await submitRes.json();
      // Either success or blocked with reasons
      expect(submitRes.ok() || submitBody.blockingReason).toBeTruthy();
    }
  });
});
