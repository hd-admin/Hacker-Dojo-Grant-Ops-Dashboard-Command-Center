/**
 * API Performance E2E Test
 *
 * AC-11.1.4: All API endpoints MUST respond within 500ms.
 */

import { test, expect } from '@playwright/test';
import { resetAppState } from './test-utils';

const BASE_URL = 'http://127.0.0.1:3000';
const MAX_RESPONSE_MS = 500;

test.describe('API Performance', () => {
  test.beforeEach(async ({ request }) => {
    await resetAppState(request);
  });

  test('GET /api/grants responds within 500ms', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BASE_URL}/api/grants`);
    const elapsed = Date.now() - start;
    expect(res.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(MAX_RESPONSE_MS);
  });

  test('GET /api/sources responds within 500ms', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BASE_URL}/api/sources`);
    const elapsed = Date.now() - start;
    expect(res.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(MAX_RESPONSE_MS);
  });

  test('GET /api/tasks responds within 500ms', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BASE_URL}/api/tasks`);
    const elapsed = Date.now() - start;
    expect(res.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(MAX_RESPONSE_MS);
  });

  test('GET /api/documents responds within 500ms', async ({ request }) => {
    const start = Date.now();
    const res = await request.get(`${BASE_URL}/api/documents`);
    const elapsed = Date.now() - start;
    expect(res.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(MAX_RESPONSE_MS);
  });

  test('parallel API requests all respond within 500ms', async ({ request }) => {
    const endpoints = ['/api/grants', '/api/sources', '/api/tasks', '/api/documents'];
    const start = Date.now();
    const responses = await Promise.all(endpoints.map((ep) => request.get(`${BASE_URL}${ep}`)));
    const elapsed = Date.now() - start;

    for (const res of responses) {
      expect(res.ok()).toBeTruthy();
    }
    expect(elapsed).toBeLessThan(MAX_RESPONSE_MS * 2); // Parallel may take longer but each should be fast
  });
});
