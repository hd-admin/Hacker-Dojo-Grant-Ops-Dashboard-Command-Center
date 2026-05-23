// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	ApprovalRecord,
	DraftArtifact,
	Grant,
	GrantDetailResponse,
	RevisionRequest,
	SubmissionRecord,
} from "../../../../../../shared/types";
import { GET, PATCH } from "./route";

const { loadGrantDetailMock, getDependenciesMock } = vi.hoisted(() => ({
	loadGrantDetailMock: vi.fn(),
	getDependenciesMock: vi.fn(),
}));

vi.mock("../../../../server/grant-ops/grant-detail", () => ({
	loadGrantDetail: loadGrantDetailMock,
}));

vi.mock("@/server/grant-ops/dependencies", () => ({
	getDependencies: getDependenciesMock,
}));

function buildGrant(id: string): Grant {
	return {
		id,
		title: "Grant Detail Workflow Test",
		funder: "Test Funder",
		funderShort: "TF",
		award: "$50,000",
		awardSort: 50000,
		deadline: "2026-12-31",
		daysOut: 200,
		fit: 82,
		tags: ["EdTech"],
		status: "review",
		statusLabel: "Review",
		matchedAt: "2026-05-01",
	};
}

function buildDetail(grant: Grant): GrantDetailResponse {
	const draft: DraftArtifact = {
		id: `draft-${Date.now()}`,
		grantId: grant.id,
		version: 1,
		content: "Draft body",
		createdAt: new Date().toISOString(),
		createdBy: "agent",
	};

	const revision: RevisionRequest = {
		id: `revision-${Date.now()}`,
		grantId: grant.id,
		draftVersion: 1,
		notes: "Tighten the outcome metrics",
		requestedAt: new Date().toISOString(),
		requestedBy: "human",
		status: "pending",
	};

	const approval: ApprovalRecord = {
		id: `approval-${Date.now()}`,
		grantId: grant.id,
		draftVersion: 1,
		approvedAt: new Date().toISOString(),
		approvedBy: "human",
	};

	const submission: SubmissionRecord = {
		id: `submission-${Date.now()}`,
		grantId: grant.id,
		submittedAt: new Date().toISOString(),
		method: {
			type: "portal",
			portalUrl: "https://example.com/portal",
			submittedBy: "human",
		},
		notes: "Submitted by human",
		followUpsCreated: [],
	};

	return {
		grant: {
			...grant,
			funderSummary: grant.funderSummary ?? "Updated funder summary",
			fitBreakdown: grant.fitBreakdown ?? {
				missionAlignment: 96,
				geographicFocus: 90,
				programTrackrecord: 88,
				budgetCapacity: 82,
				partnershipReadiness: 78,
			},
			checklist: grant.checklist ?? [
				{
					label: "Funder summary captured",
					done: true,
					source: "Prototype detail view",
				},
			],
			latestDraftVersion: grant.latestDraftVersion ?? 1,
			groundedDocumentCount: grant.groundedDocumentCount ?? 2,
			sourceCount: grant.sourceCount ?? 4,
		},
		latestDraft: draft,
		latestRevisionRequest: revision,
		approvalRecord: approval,
		submissionRecord: submission,
		followUps: [
			{
				id: `followup-${Date.now()}`,
				grantId: grant.id,
				submissionId: submission.id,
				type: "progress_check",
				title: "Check submission status",
				status: "pending",
				createdAt: new Date().toISOString(),
			},
		],
		workflow: {
			canGenerateDraft: false,
			canRequestRevision: true,
			canApprove: false,
			canSubmit: false,
			blockingReason: "Grant has already been submitted",
		},
	};
}

describe("/api/grants/[grantId]", () => {
	let grant: Grant;
	let currentDetail: GrantDetailResponse;
	const repository = {
		getGrant: vi.fn(),
		updateGrant: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();

		grant = buildGrant(`grant-${Date.now()}`);
		currentDetail = buildDetail(grant);

		repository.getGrant.mockImplementation(async (grantId: string) =>
			grantId === grant.id ? grant : null,
		);
		repository.updateGrant.mockImplementation(
			async (grantId: string, updates: Partial<Grant>) => {
				if (grantId !== grant.id) {
					return;
				}
				grant = { ...grant, ...updates };
				currentDetail = buildDetail(grant);
			},
		);

		getDependenciesMock.mockReturnValue({ repository });
		loadGrantDetailMock.mockImplementation(async (grantId: string) =>
			grantId === grant.id ? currentDetail : null,
		);
	});

	it("returns a hydrated GrantDetailResponse for GET", async () => {
		const response = await GET(
			new Request(`http://localhost/api/grants/${grant.id}`) as never,
			{
				params: Promise.resolve({ grantId: grant.id }),
			},
		);

		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data.grant.id).toBe(grant.id);
		expect(data.latestDraft.version).toBe(1);
		expect(data.latestRevisionRequest.notes).toBe(
			"Tighten the outcome metrics",
		);
		expect(data.approvalRecord.approvedBy).toBe("human");
		expect(data.submissionRecord.method.type).toBe("portal");
		expect(data.followUps).toHaveLength(1);
		expect(data.workflow.canApprove).toBe(false);
		expect(data.workflow.canSubmit).toBe(false);
		expect(data.workflow.blockingReason).toBe(
			"Grant has already been submitted",
		);
	});

	it("updates supported detail fields and returns the hydrated response for PATCH", async () => {
		const response = await PATCH(
			new Request(`http://localhost/api/grants/${grant.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					fitBreakdown: {
						missionAlignment: 97,
						geographicFocus: 91,
						programTrackrecord: 89,
						budgetCapacity: 83,
						partnershipReadiness: 79,
					},
					checklist: [
						{
							label: "Funder summary captured",
							done: true,
							source: "Prototype detail view",
						},
					],
					funderSummary: "Updated funder summary",
					sourceCount: 4,
					groundedDocumentCount: 2,
					latestDraftVersion: 3,
				}),
			}) as never,
			{ params: Promise.resolve({ grantId: grant.id }) },
		);

		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data.grant.fitBreakdown?.missionAlignment).toBe(97);
		expect(data.grant.checklist).toHaveLength(1);
		expect(data.grant.funderSummary).toBe("Updated funder summary");
		expect(data.grant.sourceCount).toBe(4);
		expect(data.grant.groundedDocumentCount).toBe(2);
		expect(data.grant.latestDraftVersion).toBe(3);
		expect(data.workflow.canSubmit).toBe(false);
	});

	it("rejects core grant fields with 400", async () => {
		const response = await PATCH(
			new Request(`http://localhost/api/grants/${grant.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: "Illegal title update",
					status: "draft",
					draftContent: "Illegal draft content update",
				}),
			}) as never,
			{ params: Promise.resolve({ grantId: grant.id }) },
		);

		const data = await response.json();
		expect(response.status).toBe(400);
		expect(data.error).toBe("Invalid grant detail payload");
	});

	it("rejects malformed payloads with 400", async () => {
		const response = await PATCH(
			new Request(`http://localhost/api/grants/${grant.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ unsupportedField: true }),
			}) as never,
			{ params: Promise.resolve({ grantId: grant.id }) },
		);

		const data = await response.json();
		expect(response.status).toBe(400);
		expect(data.error).toBe("Invalid grant detail payload");
	});

	it("returns 404 for missing grants", async () => {
		const response = await GET(
			new Request("http://localhost/api/grants/missing") as never,
			{
				params: Promise.resolve({ grantId: "missing" }),
			},
		);

		expect(response.status).toBe(404);
	});
});
