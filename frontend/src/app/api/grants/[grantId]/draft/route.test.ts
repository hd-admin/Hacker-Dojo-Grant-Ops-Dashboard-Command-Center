/**
 * Grant Draft API Route Tests
 *
 * Tests the /api/grants/[grantId]/draft endpoint using isolated temp data directory.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withTempDataDir } from "../../../../../../../shared/grant-ops-persistence";
import type {
	Grant,
	OrganizationProfile,
} from "../../../../../../../shared/types";
import * as draftingService from "../../../../../server/grant-ops/drafting-service";
import * as repository from "../../../../../server/grant-ops/repository";

function createMockGrant(id: string): Grant {
	return {
		id,
		title: "Test Grant for Draft Route",
		funder: "Test Funder",
		funderShort: "TF",
		award: "$25,000",
		awardSort: 25000,
		deadline: "2026-12-31",
		daysOut: 180,
		fit: 75,
		tags: ["Test"],
		status: "matched",
		statusLabel: "Matched",
		matchedAt: "2026-05-01",
	};
}

const mockProfile: OrganizationProfile = {
	legalName: "Hacker Dojo",
	ein: "12-3456789",
	samUEI: "XyxabC123AB",
	mission: "Test mission",
	docTypes: ["501(c)(3) letter"],
	searchThemes: ["EdTech"],
	agentBehavior: {
		autoDraftThreshold: 80,
		submissionPolicy: "human-review-required",
		notifyEmail: "ed@hackerdojo.com",
		voiceAndTone: "professional",
	},
};

describe("Grant Draft Route", () => {
	// Use isolated temp directory for each test
	let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

	beforeEach(async () => {
		// Use isolated temp directory instead of backup/restore
		tempDataDir = await withTempDataDir();
	});

	afterEach(async () => {
		// Cleanup temp directory
		await tempDataDir.cleanup();
	});

	describe("GET /api/grants/[grantId]/draft", () => {
		it("returns drafts for a grant", async () => {
			const mockGrant = createMockGrant(`draft-route-get-${Date.now()}`);
			await repository.addGrant(mockGrant);

			// Create a draft first
			await draftingService.generateDraft(mockGrant, mockProfile, {
				_providerType: "fake",
			});

			const drafts = await draftingService.getDraftArtifacts(mockGrant.id);
			expect(Array.isArray(drafts)).toBe(true);
			expect(drafts.length).toBeGreaterThan(0);
		});

		it("returns empty array when no drafts exist", async () => {
			const mockGrant = createMockGrant(`draft-route-empty-${Date.now()}`);
			await repository.addGrant(mockGrant);

			const drafts = await draftingService.getDraftArtifacts(mockGrant.id);
			expect(Array.isArray(drafts)).toBe(true);
			expect(drafts.length).toBe(0);
		});
	});

	describe("POST /api/grants/[grantId]/draft", () => {
		it("generates a draft for a grant", async () => {
			const mockGrant = createMockGrant(`draft-route-post-${Date.now()}`);
			await repository.addGrant(mockGrant);

			const draft = await draftingService.generateDraft(
				mockGrant,
				mockProfile,
				{
					_providerType: "fake",
				},
			);

			expect(draft).toBeDefined();
			expect(draft.grantId).toBe(mockGrant.id);
			expect(draft.content).toBeDefined();
		});

		it("creates a draft with version 1 for first draft", async () => {
			const mockGrant = createMockGrant(`draft-route-v1-${Date.now()}`);
			await repository.addGrant(mockGrant);

			const draft = await draftingService.generateDraft(
				mockGrant,
				mockProfile,
				{
					_providerType: "fake",
				},
			);

			expect(draft.version).toBe(1);
		});

		it("increments version for subsequent drafts", async () => {
			const mockGrant = createMockGrant(`draft-route-v2-${Date.now()}`);
			await repository.addGrant(mockGrant);

			await draftingService.generateDraft(mockGrant, mockProfile, {
				_providerType: "fake",
			});
			const draft2 = await draftingService.generateDraft(
				mockGrant,
				mockProfile,
				{
					_providerType: "fake",
				},
			);

			expect(draft2.version).toBe(2);
		});
	});
});
