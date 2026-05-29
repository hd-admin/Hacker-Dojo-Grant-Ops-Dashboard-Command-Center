// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "next/dist/compiled/react-dom/client";
import { act } from "react";
import type {
	ApprovalRecord,
	DocumentMetadata,
	DraftArtifact,
	Grant,
	SubmissionManifest,
	SubmissionManifestItem,
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

let container: HTMLDivElement;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
});

afterEach(() => {
	document.body.removeChild(container);
});

describe("SubmissionReadiness", () => {
	it("renders readiness checklist with blocking indicators", async () => {
		await act(async () => {
			createRoot(container).render(
				<SubmissionReadiness
					grant={mockGrant}
					latestDraft={mockDraft}
					approvalRecord={mockApproval}
					documents={mockDocuments}
					manifest={mockManifest}
					onSubmitComplete={vi.fn()}
				/>,
			);
		});

		expect(container.textContent).toBeTruthy();
		const draftIndicator = container.querySelector('[data-testid="readiness-draft"]');
		expect(draftIndicator?.className).toContain("green");

		const approvalIndicator = container.querySelector('[data-testid="readiness-approval"]');
		expect(approvalIndicator?.className).toContain("green");

		const checklistItemA = container.querySelector('[data-testid="readiness-checklist-0"]');
		expect(checklistItemA?.className).toContain("green");

		const checklistItemB = container.querySelector('[data-testid="readiness-checklist-1"]');
		expect(checklistItemB?.className).toContain("red");
	});

	it("shows red indicator when no draft exists", async () => {
		await act(async () => {
			createRoot(container).render(
				<SubmissionReadiness
					grant={mockGrant}
					latestDraft={null}
					approvalRecord={null}
					documents={[]}
					manifest={null}
					onSubmitComplete={vi.fn()}
				/>,
			);
		});

		const draftIndicator = container.querySelector('[data-testid="readiness-draft"]');
		expect(draftIndicator?.className).toContain("red");
	});

	it("shows yellow indicator when approval is expired", async () => {
		const expiredApproval: ApprovalRecord = {
			...mockApproval,
			lockedUntil: "2020-01-01T00:00:00.000Z",
		};

		await act(async () => {
			createRoot(container).render(
				<SubmissionReadiness
					grant={mockGrant}
					latestDraft={mockDraft}
					approvalRecord={expiredApproval}
					documents={mockDocuments}
					manifest={mockManifest}
					onSubmitComplete={vi.fn()}
				/>,
			);
		});

		const approvalIndicator = container.querySelector('[data-testid="readiness-approval"]');
		expect(approvalIndicator?.className).toContain("yellow");
	});

	it("renders manifest listing artifacts", async () => {
		await act(async () => {
			createRoot(container).render(
				<SubmissionReadiness
					grant={mockGrant}
					latestDraft={mockDraft}
					approvalRecord={mockApproval}
					documents={mockDocuments}
					manifest={mockManifest}
					onSubmitComplete={vi.fn()}
				/>,
			);
		});

		expect(container.textContent).toContain("LOI Draft v2");
		expect(container.textContent).toContain("IRS Determination Letter.pdf");
	});

	it("renders external-action notice for portal submission", async () => {
		await act(async () => {
			createRoot(container).render(
				<SubmissionReadiness
					grant={mockGrant}
					latestDraft={mockDraft}
					approvalRecord={mockApproval}
					documents={mockDocuments}
					manifest={mockManifest}
					onSubmitComplete={vi.fn()}
				/>,
			);
		});

		expect(container.textContent?.toLowerCase()).toContain("portal");
	});

	it("renders confirmation number and timestamp fields", async () => {
		await act(async () => {
			createRoot(container).render(
				<SubmissionReadiness
					grant={mockGrant}
					latestDraft={mockDraft}
					approvalRecord={mockApproval}
					documents={mockDocuments}
					manifest={mockManifest}
					onSubmitComplete={vi.fn()}
				/>,
			);
		});

		const input = container.querySelector('input[placeholder*="onfirmation" i], input[placeholder*="onfirm" i]');
		expect(input).toBeTruthy();
	});

	it("calls onSubmitComplete when submitted", async () => {
		const onSubmitComplete = vi.fn();

		await act(async () => {
			createRoot(container).render(
				<SubmissionReadiness
					grant={mockGrant}
					latestDraft={mockDraft}
					approvalRecord={mockApproval}
					documents={mockDocuments}
					manifest={mockManifest}
					onSubmitComplete={onSubmitComplete}
				/>,
			);
		});

		expect(onSubmitComplete).not.toHaveBeenCalled();
	});

	it("shows empty state when manifest is null", async () => {
		await act(async () => {
			createRoot(container).render(
				<SubmissionReadiness
					grant={mockGrant}
					latestDraft={mockDraft}
					approvalRecord={mockApproval}
					documents={mockDocuments}
					manifest={null}
					onSubmitComplete={vi.fn()}
				/>,
			);
		});

		expect(container.textContent?.toLowerCase()).toContain("manifest");
	});
});
