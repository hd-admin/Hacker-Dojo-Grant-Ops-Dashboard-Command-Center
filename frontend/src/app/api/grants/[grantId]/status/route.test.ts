// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	invalidateCache,
	withTempDataDir,
} from "../../../../../../../shared/grant-ops-persistence";
import type { Grant } from "../../../../../../../shared/types";
import * as repository from "../../../../../server/grant-ops/repository";
import { PATCH } from "./route";

function createGrant(id: string): Grant {
	return {
		id,
		title: "Test Grant for Status",
		funder: "Test Funder",
		funderShort: "TF",
		award: "$100,000",
		awardSort: 100000,
		deadline: "2026-12-31",
		daysOut: 180,
		fit: 85,
		tags: ["Test"],
		status: "matched",
		statusLabel: "Matched",
		matchedAt: "2026-05-01",
	};
}

describe("/api/grants/[grantId]/status", () => {
	let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
	let grant: Grant;

	beforeEach(async () => {
		tempDataDir = await withTempDataDir();
		invalidateCache();
		grant = createGrant(`status-${Date.now()}`);
		await repository.addGrant(grant);
	});

	afterEach(async () => {
		await tempDataDir.cleanup();
		invalidateCache();
	});

	it("returns 404 when grant is missing", async () => {
		const response = await PATCH(
			new Request("http://localhost/api/grants/missing/status", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ status: "draft", statusLabel: "Drafting" }),
			}) as never,
			{ params: Promise.resolve({ grantId: "missing" }) },
		);

		expect(response.status).toBe(404);
	});

	it("updates status and label", async () => {
		const response = await PATCH(
			new Request(`http://localhost/api/grants/${grant.id}/status`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ status: "draft", statusLabel: "Drafting" }),
			}) as never,
			{ params: Promise.resolve({ grantId: grant.id }) },
		);

		expect(response.status).toBe(200);
		expect((await repository.getGrant(grant.id))?.status).toBe("draft");
		expect((await repository.getGrant(grant.id))?.statusLabel).toBe("Drafting");
	});
});
