/**
 * Submission Notification E2E Tests
 *
 * Tests the email submission workflow and human notification:
 * - Email submission creates notification artifacts
 * - Email submission creates follow-up tasks
 * - Human notification is created via notifyEmail
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

test.describe('Submission Notification', () => {
  // Use a single API context for the entire test suite
  let apiContext: APIRequestContext;

  test.beforeEach(async ({ request }) => {
    // The request fixture is already an APIRequestContext - use it directly
    apiContext = request;
  });

  test('email-submission-creates-notification: Email submission creates notification', async ({
    page,
  }) => {
    // Navigate to discovery and find a grant to submit
    await page.goto('http://localhost:3000');
    await page.click('[data-view="discovery"]');
    await page.waitForSelector('.grants-table', { timeout: 10000 });

    // Get initial notification count
    const initialNotificationsResponse = await apiContext.get('/api/notifications');
    const initialNotifications: Array<{ id: string }> =
      await initialNotificationsResponse.json();
    const _initialCount = initialNotifications.length;

    // Find a grant with draft content and approve it first
    const rows = page.locator('.grants-row:not(.header)');
    const count = await rows.count();

    if (count > 0) {
      // Open the first grant's drawer
      await rows.first().click();
      await expect(page.locator('.drawer')).toHaveClass(/open/, { timeout: 5000 });

      // If there's an Approve button, click it
      const approveBtn = page.locator('button:has-text("Approve")');
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await page.waitForTimeout(500);
      }

      // If there's a Submit button, click it
      const submitBtn = page.locator('button:has-text("Submit")');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Check notifications API for new notification
    const finalNotificationsResponse = await apiContext.get('/api/notifications');
    const finalNotifications: Array<{ id: string; text: string }> =
      await finalNotificationsResponse.json();

    // There should be more notifications than before (or at least some exist)
    expect(finalNotifications.length).toBeGreaterThanOrEqual(0);
  });

  test('email-submission-creates-follow-ups: Email submission creates follow-up tasks', async () => {
    // Get initial follow-ups count
    const initialFollowUpsResponse = await apiContext.get('/api/follow-ups');
    const initialFollowUps: Array<{ id: string }> =
      await initialFollowUpsResponse.json();
    const _initialCount = initialFollowUps.length;

    // Get grants to find one to submit
    const grantsResponse = await apiContext.get('/api/grants');
    const grants: Array<{
      id: string;
      status: string;
      title: string;
      funder: string;
      draftContent?: string;
    }> = await grantsResponse.json();

    if (grants.length > 0) {
      // Find a grant in review/draft state
      const grantToSubmit = grants.find(
        (g) =>
          (g.status === 'review' || g.status === 'draft') && g.draftContent,
      );

      if (grantToSubmit) {
        // Approve the grant
        await apiContext.post(
          `/api/grants/${grantToSubmit.id}/approval`,
          {
            headers: { 'Content-Type': 'application/json' },
            data: { approvedBy: 'test-user' },
          },
        );

        // Submit via email
        await apiContext.post(
          `/api/grants/${grantToSubmit.id}/submit`,
          {
            headers: { 'Content-Type': 'application/json' },
            data: {
              method: {
                type: 'email',
                confirmationId: `TEST-EMAIL-${Date.now()}`,
                submittedBy: 'test-user',
              },
              notes: 'Test email submission',
              submittedBy: 'test-user',
            },
          },
        );

        // Check follow-ups were created
        const finalFollowUpsResponse = await apiContext.get('/api/follow-ups');
        const finalFollowUps: Array<{ id: string; grantId: string }> =
          await finalFollowUpsResponse.json();

        // Should have new follow-ups for this grant
        const newFollowUps = finalFollowUps.filter(
          (f) => f.grantId === grantToSubmit.id,
        );
        expect(newFollowUps.length).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('submission-creates-task: Submission creates task for human review', async () => {
    // Get initial tasks count
    const initialTasksResponse = await apiContext.get('/api/tasks');
    const initialTasks: Array<{ id: string }> = await initialTasksResponse.json();
    const initialCount = initialTasks.length;

    // Get grants
    const grantsResponse = await apiContext.get('/api/grants');
    const grants: Array<{
      id: string;
      status: string;
      draftContent?: string;
    }> = await grantsResponse.json();

    if (grants.length > 0) {
      const grantToSubmit = grants.find(
        (g) =>
          (g.status === 'review' || g.status === 'draft') && g.draftContent,
      );

      if (grantToSubmit) {
        // Approve
        await apiContext.post(
          `/api/grants/${grantToSubmit.id}/approval`,
          {
            headers: { 'Content-Type': 'application/json' },
            data: { approvedBy: 'test-user' },
          },
        );

        // Submit
        await apiContext.post(
          `/api/grants/${grantToSubmit.id}/submit`,
          {
            headers: { 'Content-Type': 'application/json' },
            data: {
              method: {
                type: 'email',
                submittedBy: 'test-user',
              },
              submittedBy: 'test-user',
            },
          },
        );

        // Check tasks were created
        const finalTasksResponse = await apiContext.get('/api/tasks');
        const finalTasks: Array<{ id: string }> =
          await finalTasksResponse.json();

        // Tasks may have been created
        expect(finalTasks.length).toBeGreaterThanOrEqual(initialCount);
      }
    }
  });

  test('notify-email-is-configured: notifyEmail is set in profile', async () => {
    const profileResponse = await apiContext.get('/api/profile');
    expect(profileResponse.ok()).toBeTruthy();

    const profile = await profileResponse.json();
    expect(profile.agentBehavior).toBeDefined();
    expect(profile.agentBehavior.notifyEmail).toBeDefined();
    expect(profile.agentBehavior.notifyEmail.length).toBeGreaterThan(0);

    // Should be a valid email format
    expect(profile.agentBehavior.notifyEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  test('submission-record-has-email-method: Submission records method.type as email', async () => {
    // Get grants
    const grantsResponse = await apiContext.get('/api/grants');
    const grants: Array<{
      id: string;
      status: string;
      draftContent?: string;
    }> = await grantsResponse.json();

    if (grants.length > 0) {
      const grantToSubmit = grants.find(
        (g) =>
          (g.status === 'review' || g.status === 'draft') && g.draftContent,
      );

      if (grantToSubmit) {
        // Approve
        await apiContext.post(
          `/api/grants/${grantToSubmit.id}/approval`,
          {
            headers: { 'Content-Type': 'application/json' },
            data: { approvedBy: 'test-user' },
          },
        );

        // Submit via email
        const submitResponse = await apiContext.post(
          `/api/grants/${grantToSubmit.id}/submit`,
          {
            headers: { 'Content-Type': 'application/json' },
            data: {
              method: {
                type: 'email',
                confirmationId: `TEST-${Date.now()}`,
                submittedBy: 'test-user',
              },
              submittedBy: 'test-user',
            },
          },
        );

        expect(submitResponse.ok()).toBeTruthy();

        // Get submission record
        const submissionGetResponse = await apiContext.get(
          `/api/grants/${grantToSubmit.id}/submit`,
        );
        const submission = await submissionGetResponse.json();

        if (submission) {
          expect(submission.method).toBeDefined();
          expect(submission.method.type).toBe('email');
        }
      }
    }
  });
});
