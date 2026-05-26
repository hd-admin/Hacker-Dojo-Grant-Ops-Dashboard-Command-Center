/**
 * Notifications API Route Tests
 *
 * Tests the /api/notifications GET route.
 * Verifies notifications persistence layer is properly integrated.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createDependencies,
	resetDependencies,
	setDependencies,
} from "@/server/grant-ops/dependencies";
import {
	invalidateCache,
	withTempDataDir,
} from "../../../../../shared/grant-ops-persistence";
import { GET, PATCH, POST } from "./route";

describe("/api/notifications route", () => {
	beforeEach(async () => {
		invalidateCache();
	});

	describe("route handler behavior", () => {
		it("POST persists a notification and GET returns it", async () => {
			const request = new Request("http://localhost/api/notifications", {
				method: "POST",
				body: JSON.stringify({
					id: "notification-1",
					text: "<strong>Research done</strong>",
					dot: "success",
					time: "2026-01-01T00:00:00.000Z",
				}),
			}) as never;

			const postResponse = await POST(request);
			expect(postResponse.status).toBe(201);
			const created = await postResponse.json();
			expect(created.id).toBe("notification-1");
			expect(created.text).toBe("<strong>Research done</strong>");

			const getResponse = await GET();
			expect(getResponse.status).toBe(200);
			const notifications = await getResponse.json();
			expect(notifications).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						id: "notification-1",
						text: "<strong>Research done</strong>",
						dot: "success",
						time: "2026-01-01T00:00:00.000Z",
					}),
				]),
			);
		});

		it("PATCH requires a notifications array", async () => {
			const request = new Request("http://localhost/api/notifications", {
				method: "PATCH",
				body: JSON.stringify({ notifications: "nope" }),
			}) as never;

			const response = await PATCH(request);
			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({
				error: "Notifications array is required",
			});
		});

		it("PATCH replaces the stored notifications batch and sanitizes each entry", async () => {
			const request = new Request("http://localhost/api/notifications", {
				method: "PATCH",
				body: JSON.stringify({
					notifications: [
						{
							id: "n1",
							text: "<script>x</script><strong>safe</strong>",
							time: "1h ago",
							dot: "info",
						},
						{
							id: "n2",
							text: '<em style="color:red">Urgent</em>',
							time: "now",
							dot: "warning",
						},
					],
				}),
			}) as never;

			const patchResponse = await PATCH(request);
			expect(patchResponse.status).toBe(200);
			expect(await patchResponse.json()).toEqual({ success: true });

			const getResponse = await GET();
			const notifications = await getResponse.json();
			expect(notifications).toHaveLength(2);
			expect(notifications[0].text).toBe("x<strong>safe</strong>");
			expect(notifications[1].text).toBe("<em>Urgent</em>");
		});
	});

	describe("sanitization", () => {
		let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

		beforeEach(async () => {
			tempDataDir = await withTempDataDir();
			setDependencies(createDependencies());
		});

		afterEach(async () => {
			resetDependencies();
			await tempDataDir.cleanup();
		});

		it("POST strips <script> tag but preserves allowed <strong> tag", async () => {
			const request = new Request("http://localhost/api/notifications", {
				method: "POST",
				body: JSON.stringify({
					text: "<script>alert(1)</script><strong>Research done</strong>",
					dot: "success",
				}),
			}) as never;

			const response = await POST(request);
			expect(response.status).toBe(201);

			const notification = await response.json();
			expect(notification.text).toContain("<strong>Research done</strong>");
			expect(notification.text).not.toContain("<script>");
		});

		it("POST strips onclick attribute from <strong> tag", async () => {
			const request = new Request("http://localhost/api/notifications", {
				method: "POST",
				body: JSON.stringify({
					text: "<strong onclick=alert(1)>Match</strong>",
					dot: "info",
				}),
			}) as never;

			const response = await POST(request);
			expect(response.status).toBe(201);

			const notification = await response.json();
			expect(notification.text).toBe("<strong>Match</strong>");
		});

		it("POST strips style attribute from <em> tag", async () => {
			const request = new Request("http://localhost/api/notifications", {
				method: "POST",
				body: JSON.stringify({
					text: '<em style="color:red">Urgent</em>',
					dot: "warning",
				}),
			}) as never;

			const response = await POST(request);
			expect(response.status).toBe(201);

			const notification = await response.json();
			expect(notification.text).toBe("<em>Urgent</em>");
		});

		it("PATCH sanitizes all notifications in the batch", async () => {
			const request = new Request("http://localhost/api/notifications", {
				method: "PATCH",
				body: JSON.stringify({
					notifications: [
						{
							id: "n1",
							text: "<script>x</script>safe",
							time: "1h ago",
							dot: "info",
						},
					],
				}),
			}) as never;

			const patchResponse = await PATCH(request);
			expect(patchResponse.status).toBe(200);

			// Verify the stored notification is sanitized
			const getResponse = await GET();
			const notifications = await getResponse.json();
			expect(notifications[0]?.text).not.toContain("<script>");
		});
	});
});
