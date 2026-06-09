import fs from 'node:fs/promises';
import path from 'node:path';
import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import {
  BASE_URL,
  configureOpencodeThroughSettingsView,
  resetAppState,
  saveProfileThroughSettingsView,
  uploadDocumentThroughSettingsView,
} from './test-utils';

const fixturePath = path.join(
  process.cwd(),
  'tests/fixtures/documents/hacker-dojo-program-summary.pdf',
);
const opencodeStubPath = path.join(process.cwd(), 'tests/e2e/opencode-stub.sh');

async function ensureOpencodeStub(): Promise<string> {
  // Use the existing comprehensive stub that handles all job types
  await fs.chmod(opencodeStubPath, 0o755);
  return opencodeStubPath;
}

async function openMatchedGrantWithoutDraft(page: Page, request: APIRequestContext) {
  const grantsResponse = await request.get(`/api/grants`);
  expect(grantsResponse.ok()).toBeTruthy();
  const grantsData = await grantsResponse.json();
  const grants: Array<{
    id: string;
    title: string;
    fit: number;
    status: string;
    draftContent?: string;
    funder: string;
  }> = grantsData.items || grantsData;

  const targetGrant = grants.find((grant) => grant.status === 'matched' && !grant.draftContent);
  expect(targetGrant).toBeDefined();
  if (!targetGrant) {
    throw new Error('Expected a matched grant without draft content');
  }

  const sortedGrants = [...grants].sort((a, b) => b.fit - a.fit);
  const selectedIndex = sortedGrants.findIndex((grant) => grant.id === targetGrant.id);
  expect(selectedIndex).toBeGreaterThan(-1);

  await page.click('[data-view="discovery"]');
  await page.locator('.grants-row:not(.header)').nth(selectedIndex).click();
  await expect(page.locator('.drawer-title')).toHaveText(targetGrant.title);
  return targetGrant;
}

test.describe('Submission Notification', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetAppState(request);
    await page.goto(BASE_URL);
    await page.waitForSelector('.app', { timeout: 60000 });
  });

  test('notify-email-is-configured: notifyEmail is set in profile', async ({ page }) => {
    await page.click('[data-view="settings"]');
    await page.waitForSelector('#view-settings.active', { timeout: 10000 });
    await expect(page.locator('.sidebar-footer')).toContainText('ed@hackerdojo.com');
  });

  test('approval-submission-artifacts: approve, submit, and surface follow-up artifacts', async ({
    page,
    request,
  }) => {
    const stubPath = await ensureOpencodeStub();
    await saveProfileThroughSettingsView(
      page,
      'Community innovation and education with maker pathways.',
    );
    await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
    await uploadDocumentThroughSettingsView(page, fixturePath);

    const targetGrant = await openMatchedGrantWithoutDraft(page, request);

    await expect(page.locator('button:has-text("Generate draft")')).toBeVisible();
    await page.getByRole('button', { name: 'Generate draft' }).click();
    await expect(page.locator('.draft-preview')).toContainText(
      'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
    );
    await expect(page.locator('.ai-badge')).toContainText('Drafted by agent');

    await page.getByRole('button', { name: 'Approve and lock' }).click();
    await expect(page.locator('.drawer-actions').first()).toContainText('Submit');

    await page.locator('.drawer-actions').first().getByRole('button', { name: 'Submit' }).click();
    await page
      .locator('.drawer-section')
      .filter({ hasText: 'Submit grant' })
      .locator('select')
      .selectOption('email');
    await page.locator('input[placeholder="Confirmation ID"]').fill(`PW-${Date.now()}`);
    await page
      .locator('textarea[placeholder="Submission notes"]')
      .fill('Submitted from the drawer workflow');
    await page
      .locator('.drawer-section')
      .filter({ hasText: 'Submit grant' })
      .getByRole('button', { name: 'Confirm submission' })
      .click();

    const grantDetailResponse = await request.get(`/api/grants/${targetGrant.id}`);
    expect(grantDetailResponse.ok()).toBeTruthy();
    const grantDetail = await grantDetailResponse.json();
    expect(grantDetail.grant.status).toBe('submitted');
    expect(grantDetail.submissionRecord?.grantId).toBe(targetGrant.id);
    expect(Array.isArray(grantDetail.followUps)).toBe(true);
    expect(grantDetail.followUps.length).toBeGreaterThan(0);

    const followUpsResponse = await request.get(`/api/follow-ups`);
    expect(followUpsResponse.ok()).toBeTruthy();
    const followUps = (await followUpsResponse.json()) as Array<{
      grantId?: string;
      submissionId?: string;
      title: string;
    }>;
    expect(followUps.some((followUp) => followUp.grantId === targetGrant.id)).toBe(true);

    const notificationsResponse = await request.get(`/api/notifications`);
    expect(notificationsResponse.ok()).toBeTruthy();
    const notifications = (await notificationsResponse.json()) as Array<{ text: string }>;
    expect(
      notifications.some((notification) => /Email submission sent to/i.test(notification.text)),
    ).toBe(true);

    const tasksResponse = await request.get(`/api/tasks`);
    expect(tasksResponse.ok()).toBeTruthy();
    const tasks = (await tasksResponse.json()) as Array<{ text: string; completed: boolean }>;
    expect(tasks.some((task) => /Follow up on email submission/i.test(task.text))).toBe(true);

    await page.click('[data-view="notifications"]');
    await expect(page.locator('body')).toContainText('Email submission sent to');

    await page.click('[data-view="tasks"]');
    await expect(page.locator('body')).toContainText('Follow up on email submission');
  });
});
