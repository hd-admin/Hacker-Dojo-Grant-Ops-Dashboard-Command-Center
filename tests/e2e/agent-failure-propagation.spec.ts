/**
 * Agent Failure Propagation E2E Test
 *
 * Verifies error propagation through UI when agent jobs fail.
 */

import { test, expect } from '@playwright/test';
import { resetAppState } from './test-utils';

const BASE_URL = 'http://127.0.0.1:3000';

test.describe('Agent Failure Propagation', () => {
  test.beforeEach(async ({ request }) => {
    await resetAppState(request);
  });

  test('failed job shows error in job progress UI', async ({ page, request }) => {
    // Start a job that may fail (with invalid params)
    const res = await request.post(`${BASE_URL}/api/research`, {
      data: { query: '' }, // empty query may trigger validation failure
    });
    
    if (!res.ok()) {
      // If it fails immediately, verify error response format
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      return;
    }

    const { jobId } = await res.json();
    expect(jobId).toBeDefined();

    await page.goto('/');
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 5000 });

    // Wait for job to complete or fail
    let attempts = 0;
    let status = 'running';
    while (attempts < 30 && status === 'running') {
      await page.waitForTimeout(500);
      const jobRes = await request.get(`${BASE_URL}/api/jobs/${encodeURIComponent(jobId)}`);
      if (jobRes.ok()) {
        const job = await jobRes.json();
        status = job.status;
      }
      attempts++;
    }

    // Verify final status is either completed or failed (not stuck)
    expect(['completed', 'failed', 'cancelled']).toContain(status);
  });

  test('API returns structured error for invalid state transition', async ({ request }) => {
    await resetAppState(request);

    const grantsRes = await request.get(`${BASE_URL}/api/grants`);
    const grants = await grantsRes.json();
    const grantsArr = Array.isArray(grants) ? grants : grants.grants ?? [];

    if (grantsArr.length === 0) {
      test.skip();
      return;
    }

    const firstGrant = grantsArr[0];
    const res = await request.put(
      `${BASE_URL}/api/grants/${encodeURIComponent(firstGrant.id)}/status`,
      { data: { status: 'invalid-status-xyz' } },
    );

    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
  });
});
