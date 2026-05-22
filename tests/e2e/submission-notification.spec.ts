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

  test('email-submission-creates-notification: Email submission creates notification', async ({
    _page,
  }) => {
    // First ensure we have a grant with draft content
    const grantsResponse = await apiContext.get('/api/grants');
    expect(grantsResponse.ok()).toBeTruthy();
    const grants: Array<{
      id: string;
      status: string;
      title: string;
      funder: string;
      draftContent?: string;
    }> = await grantsResponse.json();

    // Find a grant in draft state that we can work with
    const draftGrant = grants.find(
      (g) => g.status === 'draft' && g.draftContent,
    );

    if (!draftGrant) {
      // Skip if no draft grant available - this is a data dependency issue
      test.skip();
      return;
    }

    // Get initial notification count
    const initialNotificationsResponse = await apiContext.get('/api/notifications');
    const initialNotifications: Array<{ id: string }> =
      await initialNotificationsResponse.json();
    const initialCount = initialNotifications.length;

    // Approve the grant first
    await apiContext.post(
      `/api/grants/${draftGrant.id}/approval`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { approvedBy: 'test-user' },
      },
    );

    // Submit via email
    await apiContext.post(
      `/api/grants/${draftGrant.id}/submit`,
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

    // Check notifications API for new notification
    const finalNotificationsResponse = await apiContext.get('/api/notifications');
    const finalNotifications: Array<{ id: string; text: string; grantId?: string }> =
      await finalNotificationsResponse.json();

    // There should be more notifications than before
    expect(finalNotifications.length).toBeGreaterThan(initialCount);

    // Find notification for this grant
    const grantNotification = finalNotifications.find(
      (n) => n.grantId === draftGrant.id,
    );
    expect(grantNotification).toBeDefined();
  });

  test('email-submission-creates-follow-ups: Email submission creates follow-up tasks', async () => {
    // Get grants
    const grantsResponse = await apiContext.get('/api/grants');
    expect(grantsResponse.ok()).toBeTruthy();
    const grants: Array<{
      id: string;
      status: string;
      title: string;
      funder: string;
      draftContent?: string;
    }> = await grantsResponse.json();

    // Find a grant in draft state
    const draftGrant = grants.find(
      (g) => g.status === 'draft' && g.draftContent,
    );

    if (!draftGrant) {
      test.skip();
      return;
    }

    // Approve the grant
    await apiContext.post(
      `/api/grants/${draftGrant.id}/approval`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { approvedBy: 'test-user' },
      },
    );

    // Submit via email
    const submitResponse = await apiContext.post(
      `/api/grants/${draftGrant.id}/submit`,
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
    expect(submitResponse.ok()).toBeTruthy();

    // Check follow-ups were created
    const finalFollowUpsResponse = await apiContext.get('/api/follow-ups');
    const finalFollowUps: Array<{ id: string; grantId: string }> =
      await finalFollowUpsResponse.json();

    // Should have follow-ups for this grant
    const newFollowUps = finalFollowUps.filter(
      (f) => f.grantId === draftGrant.id,
    );
    expect(newFollowUps.length).toBeGreaterThan(0);
  });

  test('submission-creates-task: Submission creates task for human review', async () => {
    // Get grants
    const grantsResponse = await apiContext.get('/api/grants');
    expect(grantsResponse.ok()).toBeTruthy();
    const grants: Array<{
      id: string;
      status: string;
      draftContent?: string;
    }> = await grantsResponse.json();

    const draftGrant = grants.find(
      (g) => g.status === 'draft' && g.draftContent,
    );

    if (!draftGrant) {
      test.skip();
      return;
    }

    // Approve
    await apiContext.post(
      `/api/grants/${draftGrant.id}/approval`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { approvedBy: 'test-user' },
      },
    );

    // Submit
    const submitResponse = await apiContext.post(
      `/api/grants/${draftGrant.id}/submit`,
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

    // Check tasks were created for this grant
    const finalTasksResponse = await apiContext.get('/api/tasks');
    const finalTasks: Array<{ id: string; grantId?: string }> =
      await finalTasksResponse.json();

    // Find task for this grant
    const grantTask = finalTasks.find((t) => t.grantId === draftGrant.id);
    expect(grantTask).toBeDefined();
  });

  test('submission-record-has-email-method: Submission records method.type as email', async () => {
    // Get grants
    const grantsResponse = await apiContext.get('/api/grants');
    expect(grantsResponse.ok()).toBeTruthy();
    const grants: Array<{
      id: string;
      status: string;
      draftContent?: string;
    }> = await grantsResponse.json();

    const draftGrant = grants.find(
      (g) => g.status === 'draft' && g.draftContent,
    );

    if (!draftGrant) {
      test.skip();
      return;
    }

    // Approve
    await apiContext.post(
      `/api/grants/${draftGrant.id}/approval`,
      {
        headers: { 'Content-Type': 'application/json' },
        data: { approvedBy: 'test-user' },
      },
    );

    // Submit via email
    const submitResponse = await apiContext.post(
      `/api/grants/${draftGrant.id}/submit`,
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

    // Verify submission record has email method
    const submissionGetResponse = await apiContext.get(
      `/api/grants/${draftGrant.id}/submit`,
    );
    const submission = await submissionGetResponse.json();

    expect(submission).toBeDefined();
    expect(submission.method).toBeDefined();
    expect(submission.method.type).toBe('email');
  });
});
