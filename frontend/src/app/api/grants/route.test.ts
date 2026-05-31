/**
 * Grants API Route Tests
 *
 * Tests the /api/grants endpoint for listing grants.
 * These tests exercise the actual route handler to verify the route contract
 * and assert the exact required ID order for fit, deadline with Rolling last, and award.
 */

import type { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the entire dependencies module before importing the route
vi.mock("@/server/grant-ops/dependencies", () => ({
	getDependencies: vi.fn(),
	setDependencies: vi.fn(),
	resetDependencies: vi.fn(),
	createDependencies: vi.fn(),
	systemClock: { now: () => new Date() },
	cryptoIdGenerator: { generateId: (prefix: string) => `${prefix}-test` },
	cwdPersistenceRoot: { getBaseDir: () => "/tmp/test" },
}));

import { getDependencies } from "@/server/grant-ops/dependencies";
import { invalidateCache } from "../../../../../shared/grant-ops-persistence";
// Import route after mocking
import { GET } from "./route";

// Mock NextRequest
vi.mock("next/server", async () => {
	const actual =
		await vi.importActual<typeof import("next/server")>("next/server");
	return {
		...actual,
		connection: async () => {},
		NextRequest: class MockNextRequest {
			url: string;
			constructor(url: string | URL) {
				this.url = url.toString();
			}
		},
	};
});

describe("Grants API Route", () => {
	// Mock grants in UNSORTED order to verify route sorting
	// This ensures the route is actually sorting, not just returning mock data in order
	const mockGrants = [
		{
			id: "dell-equality",
			title: "Dell Equality Initiative",
			funder: "Dell Technologies",
			funderShort: "Dell",
			award: "$150,000",
			awardSort: 150000,
			deadline: "2026-07-15",
			daysOut: 54,
			fit: 76,
			tags: ["Equality"],
			status: "matched",
			statusLabel: "Matched",
			matchedAt: "2026-05-01",
		},
		{
			id: "google-cs",
			title: "Google CS Research",
			funder: "Google",
			funderShort: "Google",
			award: "$100,000",
			awardSort: 100000,
			deadline: "2026-06-01",
			daysOut: 10,
			fit: 79,
			tags: ["CS", "Research"],
			status: "matched",
			statusLabel: "Matched",
			matchedAt: "2026-05-01",
		},
		{
			id: "svcf-community",
			title: "SVCF Community Grants",
			funder: "Silicon Valley Community Foundation",
			funderShort: "SVCF",
			award: "$75,000",
			awardSort: 75000,
			deadline: "Rolling",
			daysOut: 999,
			fit: 82,
			tags: ["Community"],
			status: "matched",
			statusLabel: "Matched",
			matchedAt: "2026-05-01",
		},
		{
			id: "nsf-tech",
			title: "NSF Technology Innovation",
			funder: "National Science Foundation",
			funderShort: "NSF",
			award: "$350,000",
			awardSort: 350000,
			deadline: "2026-06-15",
			daysOut: 24,
			fit: 88,
			tags: ["Technology", "Innovation"],
			status: "matched",
			statusLabel: "Matched",
			matchedAt: "2026-05-01",
		},
	];

	beforeEach(() => {
		invalidateCache();
		vi.clearAllMocks();

		// Setup mock dependencies
		const mockRepo = {
			getGrants: vi.fn().mockResolvedValue(mockGrants),
			getGrant: vi.fn(),
			addGrant: vi.fn(),
			updateGrant: vi.fn(),
			deleteGrant: vi.fn(),
			getDraftArtifacts: vi.fn(),
			addDraftArtifact: vi.fn(),
			getRevisionRequests: vi.fn(),
			addRevisionRequest: vi.fn(),
			getApprovalRecord: vi.fn(),
			addApprovalRecord: vi.fn(),
			getSubmissionRecord: vi.fn(),
			addSubmissionRecord: vi.fn(),
			getFollowUps: vi.fn(),
			addFollowUp: vi.fn(),
		};

		(getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
			repository: mockRepo,
			sourceService: {
				getAllSources: vi.fn(),
				getSource: vi.fn(),
				addSource: vi.fn(),
				updateSource: vi.fn(),
				deleteSource: vi.fn(),
			},
			createOpencodeAdapter: vi.fn(),
			clock: { now: () => new Date() },
			idGenerator: {
				generateId: (prefix: string) => `${prefix}-${Date.now()}-test`,
			},
			persistenceRoot: { getBaseDir: () => "/tmp/test" },
		});
	});

	afterEach(() => {
		invalidateCache();
		vi.restoreAllMocks();
	});

	describe("GET /api/grants", () => {
		it("returns grants through the route handler", async () => {
			// Create mock request with default sortBy=fit
			const { NextRequest } = require("next/server");
			const mockRequest = new NextRequest("http://localhost:3000/api/grants");

			const response = await GET(mockRequest);
			const data = await (response as NextResponse).json();

			// Verify the handler called getDependencies
			expect(getDependencies).toHaveBeenCalled();

			// Verify the grants are returned
			expect(data.grants).toBeDefined();
			expect(data.grants.length).toBe(4);
		});

		it("returns grants with required fields from route", async () => {
			const { NextRequest } = require("next/server");
			const mockRequest = new NextRequest(
				"http://localhost:3000/api/grants?sortBy=fit",
			);

			const response = await GET(mockRequest);
			const data = await (response as NextResponse).json();

			expect(data.grants).toBeDefined();
			expect(data.grants.length).toBe(4);

			// Verify each grant has required fields
			for (const grant of data.grants) {
				expect(grant).toHaveProperty("id");
				expect(grant).toHaveProperty("title");
				expect(grant).toHaveProperty("funder");
				expect(grant).toHaveProperty("award");
				expect(grant).toHaveProperty("awardSort");
				expect(grant).toHaveProperty("deadline");
				expect(grant).toHaveProperty("daysOut");
				expect(grant).toHaveProperty("fit");
				expect(grant).toHaveProperty("status");
			}
		});

		it("returns grants sorted by fit descending (default)", async () => {
			const { NextRequest } = require("next/server");
			const mockRequest = new NextRequest(
				"http://localhost:3000/api/grants?sortBy=fit",
			);

			const response = await GET(mockRequest);
			const data = await (response as NextResponse).json();

			// Mock data order: dell-equality (76), google-cs (79), svcf-community (82), nsf-tech (88)
			// Expected sorted order by fit descending: nsf-tech (88), svcf-community (82), google-cs (79), dell-equality (76)
			const expectedOrder = [
				"nsf-tech",
				"svcf-community",
				"google-cs",
				"dell-equality",
			];
			const actualOrder = data.grants.map((g: { id: string }) => g.id);
			expect(actualOrder).toEqual(expectedOrder);

			// Also verify fit scores are in descending order
			const fitScores = data.grants.map((g: { fit: number }) => g.fit);
			expect(fitScores).toEqual([88, 82, 79, 76]);
		});

		it("returns grants sorted by deadline soonest with Rolling last", async () => {
			const { NextRequest } = require("next/server");
			const mockRequest = new NextRequest(
				"http://localhost:3000/api/grants?sortBy=deadline",
			);

			const response = await GET(mockRequest);
			const data = await (response as NextResponse).json();

			// Expected order by daysOut: google-cs (10d), nsf-tech (24d), dell-equality (54d), svcf-community (Rolling)
			const expectedOrder = [
				"google-cs",
				"nsf-tech",
				"dell-equality",
				"svcf-community",
			];
			const actualOrder = data.grants.map((g: { id: string }) => g.id);
			expect(actualOrder).toEqual(expectedOrder);

			// Verify Rolling is last
			const rollingIndex = actualOrder.indexOf("svcf-community");
			expect(rollingIndex).toBe(actualOrder.length - 1);
		});

		it("returns grants sorted by award descending", async () => {
			const { NextRequest } = require("next/server");
			const mockRequest = new NextRequest(
				"http://localhost:3000/api/grants?sortBy=award",
			);

			const response = await GET(mockRequest);
			const data = await (response as NextResponse).json();

			// Expected order by awardSort descending: nsf-tech ($350k), dell-equality ($150k), google-cs ($100k), svcf-community ($75k)
			const expectedOrder = [
				"nsf-tech",
				"dell-equality",
				"google-cs",
				"svcf-community",
			];
			const actualOrder = data.grants.map((g: { id: string }) => g.id);
			expect(actualOrder).toEqual(expectedOrder);

			// Verify award amounts are in descending order
			const awardAmounts = data.grants.map((g: { awardSort: number }) => g.awardSort);
			expect(awardAmounts).toEqual([350000, 150000, 100000, 75000]);
		});
	});
});
