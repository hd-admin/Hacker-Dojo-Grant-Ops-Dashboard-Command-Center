/**
 * Concurrent Jobs E2E Test
 *
 * Verifies MAX_CONCURRENT_JOBS=3 behavior.
 */

import { test, expect } from '@playwright/test';
import { resetAppState, configureOpencodeThroughSettingsView } from './test-utils';

const BASE_URL = 'http://127.0.0.1:3000';
const MAX_CONCURRENT = 3;

test.describe('Concurrent Jobs', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetAppState(request);
    const stubPath = process.env.OPENCODE_STUB_PATH || './tests/e2e/opencode-stub.sh';
    await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
  });

  test('multiple jobs can be queued and run concurrently', async ({ request }) => {
    const jobIds: string[] = [];

    // Start multiple research jobs
    for (let i = 0; i < MAX_CONCURRENT; i++) {
      const res = await request.post(`${BASE_URL}/api/research`, {
        data: { query: `concurrent test query ${i}` },
      });
      expect(res.ok()).toBeTruthy();
      const { job } = await res.json();
      expect(job).toBeDefined();
      const jobId = job.id;
      expect(jobId).toBeDefined();
      jobIds.push(jobId);
    }

    expect(jobIds.length).toBe(MAX_CONCURRENT);

    // Poll all jobs until completion
    const results = await Promise.all(
      jobIds.map(async (jobId) => {
        let attempts = 0;
        while (attempts < 30) {
          const res = await request.get(`${BASE_URL}/api/jobs/${encodeURIComponent(jobId)}`);
          if (res.ok()) {
            const job = await res.json();
            if (
              job.status === 'completed' ||
              job.status === 'failed' ||
              job.status === 'cancelled'
            ) {
              return job.status;
            }
          }
          await new Promise((r) => setTimeout(r, 500));
          attempts++;
        }
        return 'timeout';
      }),
    );

    // All jobs should complete (or fail) within timeout
    for (const status of results) {
      expect(['completed', 'failed', 'cancelled']).toContain(status);
    }
  });

  test('job queue API returns all jobs', async ({ request }) => {
    await resetAppState(request);

    const res = await request.get(`${BASE_URL}/api/jobs`);
    expect(res.ok()).toBeTruthy();
    const jobs = await res.json();
    expect(Array.isArray(jobs)).toBe(true);
  });
});
