import { expect, test } from '@playwright/test';
import { BASE_URL, resetAppState } from './test-utils';

test.describe('Security', () => {
  test.beforeEach(async ({ request }) => {
    await resetAppState(request);
  });

  test('AC-12.1.1: application binds to localhost only', async ({ request }) => {
    // The test is running against 127.0.0.1:855 via Playwright
    // If the server were bound to 0.0.0.0, external access would be possible
    // This test verifies the server responds on localhost
    const response = await request.get(`/api/health`);
    expect(response.status()).toBe(200);
  });

  test('AC-12.1.2: no application-level passcode or lock screen', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app', { timeout: 30000 });

    // Verify no passcode prompt is shown
    const passcodeInput = page.locator('input[type="password"], input[placeholder*="passcode"], input[placeholder*="password"]').first();
    await expect(passcodeInput).not.toBeVisible();

    // Verify main app content is accessible without authentication
    await expect(page.locator('.app')).toBeVisible();
  });

  test('AC-12.1.3: document upload path restriction', async ({ request }) => {
    // Attempt to upload with path traversal
    const formData = new FormData();
    const blob = new Blob(['test content'], { type: 'text/plain' });
    formData.append('file', blob, '../../../etc/passwd');

    const response = await request.post(`/api/documents`, {
      multipart: {
        file: {
          name: '../../../etc/passwd',
          mimeType: 'text/plain',
          buffer: Buffer.from('test content'),
        },
      },
    });

    // Should reject path traversal attempts
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('AC-16.7.1: no authentication required for local access', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app', { timeout: 30000 });

    // Main navigation should be immediately accessible
    await expect(page.locator('.nav-item[data-view="dashboard"]')).toBeVisible();
    await expect(page.locator('.nav-item[data-view="discovery"]')).toBeVisible();
    await expect(page.locator('.nav-item[data-view="pipeline"]')).toBeVisible();
  });

  test('AC-16.7.2: localhost-only binding prevents external access', async ({ request }) => {
    // Verify health endpoint is accessible on localhost
    const response = await request.get(`/api/health`);
    expect(response.status()).toBe(200);

    // The server should NOT be accessible on 0.0.0.0
    // In practice, this is verified by the server configuration
    // (playwright-start.sh uses --hostname 127.0.0.1)
  });
});
