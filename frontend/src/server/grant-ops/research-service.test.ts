/**
 * Research Service Tests (TDD)
 *
 * These tests guard the missing behaviors identified in the analysis:
 * - runResearch persists crawlRun metadata (completedAt, status, grantsFound, grantsMatched)
 * - runResearch updates source lastCrawledAt after successful crawl
 * - runResearch leaves grants ranked so discovery can sort by fit/deadline/award
 *
 * Uses isolated test data directory for proper test isolation.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withTempDataDir } from "../../../../shared/grant-ops-persistence";
import type { OrganizationProfile } from "../../../../shared/types";
import { createDependencies, resetDependencies, setDependencies } from "./dependencies";
import * as repository from "./repository";
import * as researchService from "./research-service";
import * as sourceService from "./source-service";

const mockProfile: OrganizationProfile = {
	legalName: "Hacker Dojo",
	ein: "12-3456789",
	samUEI: "XyxabC123AB",
	mission: "To support tech education and community innovation",
	docTypes: ["501(c)(3) letter", "SAM registration", "Organizational budget"],
	searchThemes: ["EdTech", "Community Innovation", "Science & Tech"],
	agentBehavior: {
		autoDraftThreshold: 80,
		submissionPolicy: "human-review-required",
		notifyEmail: "ed@hackerdojo.com",
		voiceAndTone: "professional",
	},
};

describe("ResearchService", () => {
	// Use isolated temp directory for each test
	let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

	beforeEach(async () => {
		// Use isolated temp directory instead of backup/restore
		tempDataDir = await withTempDataDir();
	});

	afterEach(async () => {
		// Cleanup temp directory
		resetDependencies();
		await tempDataDir.cleanup();
	});

	describe("runResearch persistence", () => {
		it("FAILS: runResearch should persist crawlRun with completedAt after successful crawl", async () => {
			// Add a test source
			await sourceService.addSource({
				name: "Test Source",
				url: "https://example.com/grants",
				type: "website",
			});

			// Run research
			const result = await researchService.runResearch(mockProfile, {
				_providerType: "fake",
			});

			// The crawlRun should have completedAt set
			expect(result.crawlRun.completedAt).toBeDefined();
			expect(result.crawlRun.completedAt).not.toBeNull();
		});

		it("FAILS: runResearch should persist crawlRun with status completed", async () => {
			// Add a test source
			await sourceService.addSource({
				name: "Test Source",
				url: "https://example.com/grants",
				type: "website",
			});

			// Run research
			const result = await researchService.runResearch(mockProfile, {
				_providerType: "fake",
			});

			// Status should be completed
			expect(result.crawlRun.status).toBe("completed");
		});

		it("FAILS: runResearch should persist crawlRun with grantsFound count", async () => {
			// Add a test source
			await sourceService.addSource({
				name: "Test Source",
				url: "https://example.com/grants",
				type: "website",
			});

			// Run research
			const result = await researchService.runResearch(mockProfile, {
				_providerType: "fake",
			});

			// grantsFound should be set and non-negative
			expect(result.crawlRun.grantsFound).toBeGreaterThanOrEqual(0);
		});

		it("FAILS: runResearch should persist crawlRun with grantsMatched count", async () => {
			// Add a test source
			await sourceService.addSource({
				name: "Test Source",
				url: "https://example.com/grants",
				type: "website",
			});

			// Run research
			const result = await researchService.runResearch(mockProfile, {
				_providerType: "fake",
			});

			// grantsMatched should be set and non-negative
			expect(result.crawlRun.grantsMatched).toBeGreaterThanOrEqual(0);
		});
	});

	describe("runResearch source lastCrawledAt", () => {
		it("FAILS: runResearch should update source lastCrawledAt after successful crawl", async () => {
			// Add a test source
			const source = await sourceService.addSource({
				name: "Test Source",
				url: "https://example.com/grants",
				type: "website",
			});

			// Verify source has no lastCrawledAt initially
			const sourcesBefore = await sourceService.getAllSources();
			const sourceBefore = sourcesBefore.find((s) => s.id === source.id);
			expect(sourceBefore?.lastCrawledAt).toBeUndefined();

			// Run research
			await researchService.runResearch(mockProfile, {
				_providerType: "fake",
			});

			// Source should now have lastCrawledAt set
			const sourcesAfter = await sourceService.getAllSources();
			const sourceAfter = sourcesAfter.find((s) => s.id === source.id);
			expect(sourceAfter?.lastCrawledAt).toBeDefined();
			expect(sourceAfter?.lastCrawledAt).not.toBeNull();
		});

		it("FAILS: runResearch should stamp lastCrawledAt even when a successful crawl returns empty content", async () => {
			setDependencies(
				createDependencies({
					createOpencodeAdapter: () => ({
						executeResearch: async () => ({ success: true, content: "" }),
						generateDraft: async () => ({ success: true, content: "" }),
						isConfigured: () => true,
					}),
				}),
			);

			const source = await sourceService.addSource({
				name: "Empty Content Source",
				url: "https://example.com/empty",
				type: "website",
			});

			await researchService.runResearch(mockProfile, {
				_providerType: "fake",
			});

			const sourcesAfter = await sourceService.getAllSources();
			const sourceAfter = sourcesAfter.find((s) => s.id === source.id);
			expect(sourceAfter?.lastCrawledAt).toBeDefined();
		});
	});

	describe("runResearch ranked grants for discovery sorting", () => {
		it("FAILS: runResearch should leave grants with fit scores for fit sorting", async () => {
			// Add a test source
			await sourceService.addSource({
				name: "Test Source",
				url: "https://example.com/grants",
				type: "website",
			});

			// Run research
			const result = await researchService.runResearch(mockProfile, {
				_providerType: "fake",
			});

			// Grants found should be accessible for sorting
			expect(result.grantsFound >= 0).toBe(true);

			// Get grants and verify they have fit scores
			const grants = await repository.getGrants();
			if (grants.length > 0) {
				const matchedGrants = grants.filter((g) => g.status === "matched");
				for (const grant of matchedGrants) {
					expect(grant.fit).toBeGreaterThan(0);
				}
			}

			const researchedGrant = grants.find((grant) => grant.funder === 'Mock Foundation');
			expect(researchedGrant?.funderSummary).toContain('Mock Foundation');
			expect(researchedGrant?.fitBreakdown).toBeDefined();
			expect(researchedGrant?.sourceCount).toBe(1);
			expect(researchedGrant?.groundedDocumentCount).toBe(0);
			expect(researchedGrant?.latestDraftVersion).toBe(0);
			expect(researchedGrant?.checklist?.length).toBeGreaterThan(0);
		});

		it("FAILS: runResearch should leave grants with deadline info for deadline sorting", async () => {
			// Add a test source
			await sourceService.addSource({
				name: "Test Source",
				url: "https://example.com/grants",
				type: "website",
			});

			// Run research
			const result = await researchService.runResearch(mockProfile, {
				_providerType: "fake",
			});

			// The research result should indicate grants were found
			expect(result.grantsFound >= 0).toBe(true);

			// Get grants and verify they have deadline info
			const grants = await repository.getGrants();
			if (grants.length > 0) {
				const matchedGrants = grants.filter((g) => g.status === "matched");
				for (const grant of matchedGrants) {
					expect(grant.deadline).toBeDefined();
				}
			}
		});

		it("FAILS: runResearch should leave grants with award amounts for award sorting", async () => {
			// Add a test source
			await sourceService.addSource({
				name: "Test Source",
				url: "https://example.com/grants",
				type: "website",
			});

			// Run research
			const result = await researchService.runResearch(mockProfile, {
				_providerType: "fake",
			});

			// The research result should indicate grants were found
			expect(result.grantsFound >= 0).toBe(true);

			// Get grants and verify they have award amounts
			const grants = await repository.getGrants();
			if (grants.length > 0) {
				const matchedGrants = grants.filter((g) => g.status === "matched");
				for (const grant of matchedGrants) {
					expect(grant.awardSort).toBeGreaterThanOrEqual(0);
				}
			}
		});
	});
});
