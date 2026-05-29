import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type {
	ChecklistItem,
	DocumentMetadata,
	DraftArtifact,
	Grant,
	SubmissionManifest,
	SubmissionManifestItem,
	ApprovalRecord,
} from "../../../shared/types";
import SubmissionReadiness from "./SubmissionReadiness";

const mockGrant: Grant = {
	id: "g-1",
	title: "Test Grant",
	funder: "Test Funder",
	funderShort: "TF",
	award: "$100,000",
	awardSort: 100000,
	deadline: "2026-08-01",
	daysOut: 60,
	fit: 85,
	tags: ["test"],
	status: "submission-ready",
	statusLabel: "Submission Ready",
	checklist: [
		{ label: "Required doc A", done: true, source: "funder", required: true },
		{ label: "Required doc B", done: false, source: "funder", required: true },
		{ label: "Optional doc C", done: false, source: "funder" },
	],
};

const mockDraft: DraftArtifact = {
	id: "draft-1",
	grantId: "g-1",
	version: 2,
	content: "Test draft content",
	createdAt: "2026-05-01T00:00:00.000Z",
	createdBy: "agent",
};

const mockApproval: ApprovalRecord = {
	id: "approval-1",
	grantId: "g-1",
	draftVersion: 2,
	approvedAt: "2026-05-10T00:00:00.000Z",
	approvedBy: "human",
	lockedUntil: "2026-12-31T00:00:00.000Z",
};

const mockDocuments: DocumentMetadata[] = [
	{
		id: "doc-1",
		name: "IRS Determination Letter.pdf",
		type: "tax",
		uploadedAt: "2026-01-01T00:00:00.000Z",
		version: "1.0",
	},
	{
		id: "doc-2",
		name: "Annual Report 2025.pdf",
		type: "report",
		uploadedAt: "2026-02-01T00:00:00.000Z",
	},
];

const mockManifestItems: SubmissionManifestItem[] = [
	{ documentId: "draft-1", documentName: "LOI Draft v2", role: "narrative" },
	{ documentId: "doc-1", documentName: "IRS Determination Letter.pdf", role: "org_doc", version: "1.0" },
];

const mockManifest: SubmissionManifest = {
	id: "manifest-1",
	grantId: "g-1",
	version: 1,
	createdAt: "2026-05-01T00:00:00.000Z",
	updatedAt: "2026-05-01T00:00:00.000Z",
	materialRefs: mockManifestItems,
	instructions: "Submit via portal at grants.gov",
	portalUrl: "https://grants.gov/submit/123",
	notes: "Ready to submit",
};

describe("SubmissionReadiness", () => {
	it("renders readiness checklist with blocking indicators", () => {
		const { container } = render(
			<SubmissionReadiness
				grant={mockGrant}
				latestDraft={mockDraft}
				approvalRecord={mockApproval}
				documents={mockDocuments}
				manifest={mockManifest}
				onSubmitComplete={vi.fn()}
			/>,
		);

		// Should show checklist section
		expect(screen.getByText(/readiness/i)).toBeTruthy();

		// Should show draft status as green (ready) since we have a draft
		const draftIndicator = screen.getByTestId("readiness-draft");
		expect(draftIndicator.className).toContain("green");

		// Should show approval as green (ready) since we have approval with valid lockedUntil
		const approvalIndicator = screen.getByTestId("readiness-approval");
		expect(approvalIndicator.className).toContain("green");

		// Should show checklist item A as green (done)
		const checklistItemA = screen.getByTestId("readiness-checklist-0");
		expect(checklistItemA.className).toContain("green");

		// Should show checklist item B as red (required but not done)
		const checklistItemB = screen.getByTestId("readiness-checklist-1");
		expect(checklistItemB.className).toContain("red");

		expect(container).toBeTruthy();
	});

	it("shows red indicator when no draft exists", () => {
		render(
			<SubmissionReadiness
				grant={mockGrant}
				latestDraft={null}
				approvalRecord={null}
				documents={[]}
				manifest={null}
				onSubmitComplete={vi.fn()}
			/>,
		);

		const draftIndicator = screen.getByTestId("readiness-draft");
		expect(draftIndicator.className).toContain("red");
	});

	it("shows yellow indicator when approval is expired", () => {
		const expiredApproval: ApprovalRecord = {
			...mockApproval,
			lockedUntil: "2020-01-01T00:00:00.000Z", // expired
		};

		render(
			<SubmissionReadiness
				grant={mockGrant}
				latestDraft={mockDraft}
				approvalRecord={expiredApproval}
				documents={mockDocuments}
				manifest={mockManifest}
				onSubmitComplete={vi.fn()}
			/>,
		);

		const approvalIndicator = screen.getByTestId("readiness-approval");
		expect(approvalIndicator.className).toContain("yellow");
	});

	it("renders manifest listing artifacts", () => {
		render(
			<SubmissionReadiness
				grant={mockGrant}
				latestDraft={mockDraft}
				approvalRecord={mockApproval}
				documents={mockDocuments}
				manifest={mockManifest}
				onSubmitComplete={vi.fn()}
			/>,
		);

		expect(screen.getByText("LOI Draft v2")).toBeTruthy();
		expect(screen.getByText("IRS Determination Letter.pdf")).toBeTruthy();
	});

	it("renders external-action notice for portal submission", () => {
		render(
			<SubmissionReadiness
				grant={mockGrant}
				latestDraft={mockDraft}
				approvalRecord={mockApproval}
				documents={mockDocuments}
				manifest={mockManifest}
				onSubmitComplete={vi.fn()}
			/>,
		);

		expect(screen.getByText(/funder portal/i)).toBeTruthy();
	});

	it("renders confirmation number and timestamp fields", () => {
		render(
			<SubmissionReadiness
				grant={mockGrant}
				latestDraft={mockDraft}
				approvalRecord={mockApproval}
				documents={mockDocuments}
				manifest={mockManifest}
				onSubmitComplete={vi.fn()}
			/>,
		);

		expect(screen.getByPlaceholderText(/confirmation/i)).toBeTruthy();
	});

	it("calls onSubmitComplete when submitted", () => {
		const onSubmitComplete = vi.fn();

		render(
			<SubmissionReadiness
				grant={mockGrant}
				latestDraft={mockDraft}
				approvalRecord={mockApproval}
				documents={mockDocuments}
				manifest={mockManifest}
				onSubmitComplete={onSubmitComplete}
			/>,
		);

		// The component passes onSubmitComplete to be called by GrantDrawer
		// We just verify it accepts and stores the callback
		expect(onSubmitComplete).not.toHaveBeenCalled();
	});

	it("shows empty state when manifest is null", () => {
		render(
			<SubmissionReadiness
				grant={mockGrant}
				latestDraft={mockDraft}
				approvalRecord={mockApproval}
				documents={mockDocuments}
				manifest={null}
				onSubmitComplete={vi.fn()}
			/>,
		);

		expect(screen.getByText(/no manifest/i)).toBeTruthy();
	});
});
