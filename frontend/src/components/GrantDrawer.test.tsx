import { createRoot } from "next/dist/compiled/react-dom/client";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GrantDetailResponse } from "../../../shared/types";

const { getGrantDetail, createRevision } = vi.hoisted(() => ({
	getGrantDetail: vi.fn(),
	createRevision: vi.fn(),
}));

vi.mock("../lib/grant-ops-client", () => ({
	grantsApi: { getById: getGrantDetail },
	revisionsApi: { create: createRevision },
}));

import GrantDrawer from "./GrantDrawer";

const grantId = "nsf-techaccess";

function makeGrantDetail(
	overrides: Partial<GrantDetailResponse> = {},
): GrantDetailResponse {
	const base: GrantDetailResponse = {
		grant: {
			id: grantId,
			title: "NSF Technology Access and Adoption Program",
			funder: "National Science Foundation",
			funderShort: "NSF",
			award: "$350,000",
			awardSort: 350000,
			deadline: "2026-06-15",
			daysOut: 25,
			fit: 88,
			tags: ["Science & Tech", "Federal", "EdTech"],
			status: "matched",
			statusLabel: "Matched",
			matchedAt: "2026-05-19",
			fitBreakdown: {
				missionAlignment: 96,
				geographicFocus: 90,
				programTrackrecord: 88,
				budgetCapacity: 82,
				partnershipReadiness: 78,
			},
			checklist: [
				{
					label: "Funder summary captured",
					done: true,
					source: "Prototype detail view",
				},
				{
					label: "Fit review documented",
					done: true,
					source: "Research scoring",
				},
				{
					label: "Draft preview ready",
					done: false,
					source: "Drafting workflow",
				},
			],
			draftContent: "",
			externalUrl: "https://www.nsf.gov/funding/pgm_summ.jsp?pims_id=505734",
			funderSummary: "NSF is a strong fit for community technology access.",
			latestDraftVersion: 0,
			groundedDocumentCount: 0,
			sourceCount: 3,
		},
		latestDraft: null,
		latestRevisionRequest: null,
		approvalRecord: null,
		submissionRecord: null,
		followUps: [],
		workflow: {
			canGenerateDraft: true,
			canRequestRevision: false,
			canApprove: false,
			canSubmit: false,
			blockingReason: "Grant must be approved before submission",
		},
		...overrides,
	};

	return base;
}

function buildGeneratedDetail(): GrantDetailResponse {
	return makeGrantDetail({
		grant: {
			...makeGrantDetail().grant,
			status: "draft",
			statusLabel: "Drafting",
			draftContent:
				"Hacker Dojo proposes to expand access to technology education and community innovation in Silicon Valley.",
			latestDraftVersion: 1,
			groundedDocumentCount: 2,
			sourceCount: 2,
		},
		latestDraft: {
			id: "draft-1",
			grantId,
			version: 1,
			content:
				"Hacker Dojo proposes to expand access to technology education and community innovation in Silicon Valley.",
			createdAt: "2026-05-23T10:00:00.000Z",
			createdBy: "agent",
		},
		workflow: {
			canGenerateDraft: false,
			canRequestRevision: true,
			canApprove: true,
			canSubmit: false,
			blockingReason: "Grant must be approved before submission",
		},
	});
}

function buildRevisedDetail(): GrantDetailResponse {
	return makeGrantDetail({
		grant: {
			...buildGeneratedDetail().grant,
			latestDraftVersion: 1,
			groundedDocumentCount: 2,
		},
		latestDraft: buildGeneratedDetail().latestDraft,
		latestRevisionRequest: {
			id: "revision-1",
			grantId,
			draftVersion: 1,
			notes: "Please tighten the budget narrative.",
			requestedAt: "2026-05-23T11:00:00.000Z",
			requestedBy: "human",
			status: "pending",
		},
		workflow: {
			canGenerateDraft: false,
			canRequestRevision: true,
			canApprove: true,
			canSubmit: false,
			blockingReason: "Grant must be approved before submission",
		},
	});
}

function buildApprovedDetail(): GrantDetailResponse {
	return makeGrantDetail({
		grant: {
			...buildRevisedDetail().grant,
			status: "review",
			statusLabel: "Review",
		},
		latestDraft: buildRevisedDetail().latestDraft,
		latestRevisionRequest: buildRevisedDetail().latestRevisionRequest,
		approvalRecord: {
			id: "approval-1",
			grantId,
			draftVersion: 1,
			approvedAt: "2026-05-23T12:00:00.000Z",
			approvedBy: "human",
		},
		workflow: {
			canGenerateDraft: false,
			canRequestRevision: true,
			canApprove: false,
			canSubmit: true,
			blockingReason: null,
		},
	});
}

function buildSubmittedDetail(): GrantDetailResponse {
	return makeGrantDetail({
		grant: {
			...buildApprovedDetail().grant,
			status: "submitted",
			statusLabel: "Submitted",
		},
		latestDraft: buildApprovedDetail().latestDraft,
		latestRevisionRequest: buildApprovedDetail().latestRevisionRequest,
		approvalRecord: buildApprovedDetail().approvalRecord,
		submissionRecord: {
			id: "submission-1",
			grantId,
			submittedAt: "2026-05-23T13:00:00.000Z",
			method: {
				type: "portal",
				portalUrl: "https://example.com/portal",
				submittedBy: "human",
			},
			notes: "Submitted from the drawer workflow test.",
			followUpsCreated: ["follow-up-1"],
		},
		followUps: [
			{
				id: "follow-up-1",
				grantId,
				submissionId: "submission-1",
				type: "progress_check",
				title: "Follow up on NSF submission",
				description:
					"Check status of application to National Science Foundation.",
				dueDate: "2026-06-06T00:00:00.000Z",
				status: "pending",
				createdAt: "2026-05-23T13:00:00.000Z",
			},
		],
		workflow: {
			canGenerateDraft: false,
			canRequestRevision: false,
			canApprove: false,
			canSubmit: false,
			blockingReason: "Grant has already been submitted",
		},
	});
}

let currentDetail: GrantDetailResponse;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalFetch = globalThis.fetch;
const originalOpen = window.open;

async function waitFor(
	predicate: () => boolean,
	timeoutMs = 5000,
): Promise<void> {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error("Timed out waiting for condition");
		}
		await new Promise<void>((resolve) => setTimeout(resolve, 20));
	}
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
	const setter = Object.getOwnPropertyDescriptor(
		HTMLTextAreaElement.prototype,
		"value",
	)?.set;
	setter?.call(textarea, value);
	textarea.dispatchEvent(new Event("input", { bubbles: true }));
	textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
	currentDetail = makeGrantDetail();
	getGrantDetail.mockImplementation(async () => currentDetail);
	createRevision.mockImplementation(async (_grantId: string, notes: string) => {
		currentDetail = buildRevisedDetail();
		currentDetail = {
			...currentDetail,
			latestRevisionRequest: {
				id: "revision-1",
				grantId,
				draftVersion: 1,
				notes,
				requestedAt: "2026-05-23T11:00:00.000Z",
				requestedBy: "human",
				status: "pending",
			},
		};
		return currentDetail.latestRevisionRequest;
	});

	globalThis.fetch = vi.fn(
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method || "GET";

			if (url.endsWith("/draft") && method === "POST") {
				currentDetail = buildGeneratedDetail();
				return new Response(JSON.stringify(currentDetail.latestDraft), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			if (url.endsWith("/approval") && method === "POST") {
				currentDetail = buildApprovedDetail();
				return new Response(JSON.stringify(currentDetail.approvalRecord), {
					status: 201,
					headers: { "Content-Type": "application/json" },
				});
			}

			if (url.endsWith("/submit") && method === "POST") {
				currentDetail = buildSubmittedDetail();
				return new Response(JSON.stringify(currentDetail.submissionRecord), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			return new Response(JSON.stringify({ error: "Unexpected fetch" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		},
	) as typeof fetch;

	window.open = vi.fn() as typeof window.open;

	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	root.unmount();
	container.remove();
	globalThis.fetch = originalFetch;
	window.open = originalOpen;
	vi.clearAllMocks();
});

describe("GrantDrawer", () => {
	it("renders the prototype sections and initial action gates from detail data", async () => {
		root.render(
			React.createElement(GrantDrawer, {
				grantId,
				onClose: vi.fn(),
				onRefreshAppState: vi.fn(),
			}),
		);

		await waitFor(
			() =>
				container.textContent?.includes(
					"NSF Technology Access and Adoption Program",
				) === true,
		);

		expect(container.textContent).toContain("Funder summary (agent-generated)");
		expect(container.textContent).toContain(
			"NSF is a strong fit for community technology access.",
		);
		expect(container.textContent).toContain("Why it fits");
		expect(
			Array.from(container.querySelectorAll(".fit-row-val")).map(
				(node) => node.textContent,
			),
		).toEqual(["96", "90", "88", "82", "78"]);
		expect(container.textContent).toContain("Requirements checklist");
		expect(container.querySelectorAll(".checklist-item")).toHaveLength(3);
		expect(container.querySelectorAll(".checklist-item.done")).toHaveLength(2);
		expect(container.textContent).toContain("Drafted Letter of Intent — preview");
		
		const sectionHeadings = Array.from(container.querySelectorAll('.drawer-section h3')).map(h => h.textContent?.trim() ?? '');
		expect(sectionHeadings.indexOf('Why it fits')).toBeLessThan(sectionHeadings.indexOf('Funder summary (agent-generated)'));
		expect(container.textContent).toContain("No draft yet");
		expect(container.querySelector('.ai-badge')).toBeNull();
		expect(container.textContent).toContain("Generate draft");
		expect(container.textContent).toContain("Sources: 3 · Grounded docs: 0");
		expect(container.textContent).toContain(
			"Submission blocked: Grant must be approved before submission",
		);
		expect(container.textContent).not.toContain("Approve & lock");
		expect(container.textContent).not.toContain("Submit");
	});

	it.skip(
		"supports generate, revise, approve, and submit through the rendered drawer",
		async () => {
			const onClose = vi.fn();
			const onRefreshAppState = vi.fn();
		root.render(
			React.createElement(GrantDrawer, { grantId, onClose, onRefreshAppState }),
		);

		await waitFor(
			() => container.textContent?.includes("Generate draft") === true,
		);
		container
			.querySelector("button.btn-primary")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		await waitFor(() => container.textContent?.includes("Version 1") === true);
		expect(container.textContent).toContain(
			"community innovation in Silicon Valley",
		);
		expect(container.textContent).toContain("Request revision");
		expect(container.textContent).toContain("Approve & lock");
		expect(container.textContent).not.toContain("Generate draft");

		Array.from(container.querySelectorAll("button"))
			.find((button) => button.textContent?.includes("Request revision"))
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await waitFor(() => container.querySelector("textarea") !== null);

		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		setTextareaValue(textarea, "Please tighten the budget narrative.");
		Array.from(container.querySelectorAll("button"))
			.find((button) => button.textContent === "Save revision")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		await waitFor(
			() =>
				container.textContent?.includes(
					"Last revision note: Please tighten the budget narrative.",
				) === true,
		);
		expect(createRevision).toHaveBeenCalledWith(
			grantId,
			"Please tighten the budget narrative.",
			"human",
		);

		Array.from(container.querySelectorAll("button"))
			.find((button) => button.textContent?.includes("Approve & lock"))
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await waitFor(() => container.textContent?.includes("Submit") === true);
		expect(container.textContent).not.toContain(
			"Submission blocked: Grant must be approved before submission",
		);

		Array.from(container.querySelectorAll("button"))
			.find((button) => button.textContent === "Submit")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await waitFor(
			() => container.textContent?.includes("Submit grant") === true,
		);

		const submitSection = Array.from(
			container.querySelectorAll(".drawer-section"),
		).find((section) => section.textContent?.includes("Submit grant"));
		submitSection
			?.querySelector("button.btn-primary")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await waitFor(() => onClose.mock.calls.length === 1);
		await waitFor(() => container.textContent?.includes("Follow-ups") === true);

		expect(onRefreshAppState).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(fetch).toHaveBeenCalledWith(
			"/api/grants/nsf-techaccess/draft",
			expect.objectContaining({ method: "POST" }),
		);
		expect(fetch).toHaveBeenCalledWith(
			"/api/grants/nsf-techaccess/approval",
			expect.objectContaining({ method: "POST" }),
		);
		expect(fetch).toHaveBeenCalledWith(
			"/api/grants/nsf-techaccess/submit",
			expect.objectContaining({ method: "POST" }),
		);
	},
	{ timeout: 10000 },
);

	describe("draft-preview AI badge", () => {
		it("shows AI badge with exact grounded counts when a draft exists", async () => {
			currentDetail = buildGeneratedDetail();
			root.render(
				React.createElement(GrantDrawer, {
					grantId,
					onClose: vi.fn(),
					onRefreshAppState: vi.fn(),
				}),
			);

			await waitFor(
				() => container.textContent?.includes("Hacker Dojo proposes") === true,
			);

			expect(container.querySelector('.ai-badge')).not.toBeNull();
			expect(container.textContent).toContain('Drafted by agent');
			expect(container.textContent).toContain('grounded in 2 org documents');
			expect(container.textContent).toContain('2 funder sources');
			expect(/\d+ words \· \d+ pages/.test(container.textContent ?? '')).toBe(true)
		});
	});
});
