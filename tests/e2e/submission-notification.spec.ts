/**
 * Submission Notification E2E Tests
 *
 * Tests the email submission workflow and human notification:
 * - Email submission creates notification artifacts
 * - Email submission creates follow-up tasks
 * - Human notification is created via notifyEmail
 *
 * These tests are DETERMINISTIC - they find and use grants in draft state
 * regardless of their specific IDs. No conditional skips.
 */

import { type APIRequestContext, expect, test } from "@playwright/test";
import { resetAppState } from './test-utils';

test.describe("Submission Notification", () => {
	// Use a single API context for the entire test suite
	let apiContext: APIRequestContext;

	function requireDraftGrant(
		grant: { id: string; funder: string } | undefined,
	): { id: string; funder: string } {
		if (!grant) {
			throw new Error('Expected a draft grant for submission workflow tests');
		}
		return grant;
	}

	function requireNotification(
		notification: { dot: string } | undefined,
	): { dot: string } {
		if (!notification) {
			throw new Error('Expected a submission notification');
		}
		return notification;
	}

	test.beforeEach(async ({ request }) => {
		// The request fixture is already an APIRequestContext - use it directly
		apiContext = request;
		await resetAppState(request);
		await request.patch("/api/grants/nsf-techaccess", {
			data: {
				status: "draft",
				statusLabel: "Drafting",
			},
		});
	});

	test("notify-email-is-configured: notifyEmail is set in profile", async () => {
		const profileResponse = await apiContext.get("/api/profile");
		expect(profileResponse.ok()).toBeTruthy();

		const profile = await profileResponse.json();
		expect(profile.agentBehavior).toBeDefined();
		expect(profile.agentBehavior.notifyEmail).toBeDefined();
		expect(profile.agentBehavior.notifyEmail.length).toBeGreaterThan(0);

		// Should be a valid email format
		expect(profile.agentBehavior.notifyEmail).toMatch(
			/^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		);
	});

	test("email-submission-creates-notification: Email submission creates notification", async () => {
		// Get grants - find any grant in draft state with draftContent
		const grantsResponse = await apiContext.get("/api/grants");
		expect(grantsResponse.ok()).toBeTruthy();
		const grants: Array<{
			id: string;
			status: string;
			title: string;
			funder: string;
			draftContent?: string;
		}> = await grantsResponse.json();

		// Find ANY grant in draft state that we can work with
		const draftGrant = grants.find(
			(g) => g.status === "draft" && g.draftContent,
		);

		// There should be draft grants from seed data
		expect(draftGrant).toBeDefined();
		const draftGrantChecked = requireDraftGrant(draftGrant);
		expect(draftGrantChecked.id).toBeDefined();

		// Get initial notification count
		const initialNotificationsResponse =
			await apiContext.get("/api/notifications");
		const initialNotifications: Array<{ id: string }> =
			await initialNotificationsResponse.json();
		const initialCount = initialNotifications.length;

		// Approve the grant first
		const approveResponse = await apiContext.post(
			`/api/grants/${draftGrantChecked.id}/approval`,
			{
				headers: { "Content-Type": "application/json" },
				data: { approvedBy: "test-user" },
			},
		);
		expect(approveResponse.ok()).toBeTruthy();

		// Submit via email
		const submitResponse = await apiContext.post(
			`/api/grants/${draftGrantChecked.id}/submit`,
			{
				headers: { "Content-Type": "application/json" },
				data: {
					method: {
						type: "email",
						confirmationId: `TEST-EMAIL-${Date.now()}`,
						submittedBy: "test-user",
					},
					notes: "Test email submission",
					submittedBy: "test-user",
				},
			},
		);
		expect(submitResponse.ok()).toBeTruthy();

		// Check notifications API for new notification
		const finalNotificationsResponse =
			await apiContext.get("/api/notifications");
		const finalNotifications: Array<{ id: string; text: string; dot: string }> =
			await finalNotificationsResponse.json();

		// There should be more notifications than before
		expect(finalNotifications.length).toBeGreaterThan(initialCount);

		// Find notification with submission-related text (contains the funder name)
		const submissionNotification = finalNotifications.find(
			(n) =>
				n.text.includes(draftGrantChecked.funder) &&
				n.text.includes("Email submission"),
		);
		expect(submissionNotification).toBeDefined();
		const submissionNotificationChecked = requireNotification(submissionNotification);
		expect(submissionNotificationChecked.dot).toBe("blue");
	});

	test("email-submission-creates-follow-ups: Email submission creates follow-up tasks", async () => {
		// Get grants - find any grant in draft state
		const grantsResponse = await apiContext.get("/api/grants");
		expect(grantsResponse.ok()).toBeTruthy();
		const grants: Array<{
			id: string;
			status: string;
			title: string;
			funder: string;
			draftContent?: string;
		}> = await grantsResponse.json();

		// Find ANY grant in draft state with draftContent
		const draftGrant = grants.find(
			(g) => g.status === "draft" && g.draftContent,
		);

		// There should be draft grants from seed data
		expect(draftGrant).toBeDefined();
		const draftGrantChecked = requireDraftGrant(draftGrant);
		expect(draftGrantChecked.id).toBeDefined();

		// Get initial follow-ups count
		const initialFollowUpsResponse = await apiContext.get("/api/follow-ups");
		const initialFollowUps: Array<{ id: string }> =
			await initialFollowUpsResponse.json();
		const initialCount = initialFollowUps.length;

		// Approve the grant
		const approveResponse = await apiContext.post(
			`/api/grants/${draftGrantChecked.id}/approval`,
			{
				headers: { "Content-Type": "application/json" },
				data: { approvedBy: "test-user" },
			},
		);
		expect(approveResponse.ok()).toBeTruthy();

		// Submit via email
		const submitResponse = await apiContext.post(
			`/api/grants/${draftGrantChecked.id}/submit`,
			{
				headers: { "Content-Type": "application/json" },
				data: {
					method: {
						type: "email",
						confirmationId: `TEST-EMAIL-${Date.now()}`,
						submittedBy: "test-user",
					},
					notes: "Test email submission",
					submittedBy: "test-user",
				},
			},
		);
		expect(submitResponse.ok()).toBeTruthy();

		// Check follow-ups were created
		const finalFollowUpsResponse = await apiContext.get("/api/follow-ups");
		const finalFollowUps: Array<{ id: string; grantId?: string }> =
			await finalFollowUpsResponse.json();

		// Should have more follow-ups than before
		expect(finalFollowUps.length).toBeGreaterThan(initialCount);

		// Find follow-ups for this grant
		const grantFollowUps = finalFollowUps.filter(
			(f) => f.grantId === draftGrantChecked.id,
		);
		expect(grantFollowUps.length).toBeGreaterThan(0);
	});

	test("submission-creates-task: Submission creates a follow-up task for human review", async () => {
		const grantsResponse = await apiContext.get("/api/grants");
		expect(grantsResponse.ok()).toBeTruthy();
		const grants: Array<{
			id: string;
			status: string;
			title: string;
			funder: string;
			draftContent?: string;
		}> = await grantsResponse.json();

		const draftGrant = grants.find((g) => g.status === "draft" && g.draftContent);
		expect(draftGrant).toBeDefined();
		const draftGrantChecked = requireDraftGrant(draftGrant);

		const approveResponse = await apiContext.post(
			`/api/grants/${draftGrantChecked.id}/approval`,
			{
				headers: { "Content-Type": "application/json" },
				data: { approvedBy: "test-user" },
			},
		);
		expect(approveResponse.ok()).toBeTruthy();

		const confirmationId = `TEST-${Date.now()}`;
		const submitResponse = await apiContext.post(
			`/api/grants/${draftGrantChecked.id}/submit`,
			{
				headers: { "Content-Type": "application/json" },
				data: {
					method: {
						type: "email",
						confirmationId,
						submittedBy: "test-user",
					},
					submittedBy: "test-user",
				},
			},
		);
		expect(submitResponse.ok()).toBeTruthy();

		const finalTasksResponse = await apiContext.get("/api/tasks");
		const finalTasks: Array<{ id: string; text: string; completed: boolean }> =
			await finalTasksResponse.json();

		const submissionTask = finalTasks.find(
			(task) =>
				task.text.includes(draftGrantChecked.funder) &&
				task.text.includes(confirmationId) &&
				task.completed === false,
		);
		expect(submissionTask).toBeDefined();
	});

	test("submission-record-has-email-method: Submission records method.type as email", async () => {
		// Get grants - find any grant in draft state
		const grantsResponse = await apiContext.get("/api/grants");
		expect(grantsResponse.ok()).toBeTruthy();
		const grants: Array<{
			id: string;
			status: string;
			draftContent?: string;
		}> = await grantsResponse.json();

		// Find ANY grant in draft state
		const draftGrant = grants.find(
			(g) => g.status === "draft" && g.draftContent,
		);

		// There should be draft grants from seed data
		expect(draftGrant).toBeDefined();
		const draftGrantChecked = requireDraftGrant(draftGrant);
		expect(draftGrantChecked.id).toBeDefined();

		// Approve
		const approveResponse = await apiContext.post(
			`/api/grants/${draftGrantChecked.id}/approval`,
			{
				headers: { "Content-Type": "application/json" },
				data: { approvedBy: "test-user" },
			},
		);
		expect(approveResponse.ok()).toBeTruthy();

		// Submit via email
		const submitResponse = await apiContext.post(
			`/api/grants/${draftGrantChecked.id}/submit`,
			{
				headers: { "Content-Type": "application/json" },
				data: {
					method: {
						type: "email",
						confirmationId: `TEST-${Date.now()}`,
						submittedBy: "test-user",
					},
					submittedBy: "test-user",
				},
			},
		);

		expect(submitResponse.ok()).toBeTruthy();

		// Verify submission record has email method
		const submissionGetResponse = await apiContext.get(
			`/api/grants/${draftGrantChecked.id}/submit`,
		);
		const submission = await submissionGetResponse.json();

		expect(submission).toBeDefined();
		expect(submission.method).toBeDefined();
		expect(submission.method.type).toBe("email");
	});
});
