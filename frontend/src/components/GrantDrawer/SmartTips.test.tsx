// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "next/dist/compiled/react-dom/client";
import type { DocumentMetadata, GrantDetailResponse, SubmissionManifest } from "../../../../shared/types";
import { SmartTips } from "./SmartTips";
import type { GrantDrawerViewModel } from "./utilities";

vi.mock("../SubmissionReadiness", () => ({
  SubmissionReadiness: () => React.createElement("div", { "data-testid": "submission-readiness" }),
}));

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for condition");
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function makeDetail(overrides: Partial<GrantDetailResponse> = {}): GrantDetailResponse {
  return {
    grant: {
      id: "g1", title: "Test Grant", funder: "Test Foundation", funderShort: "TF", award: "$100,000", awardSort: 100000,
      deadline: "2026-06-15", daysOut: 25, fit: 88, tags: ["Education"], status: "matched", statusLabel: "Matched",
      matchedAt: "2026-05-19",
      fitBreakdown: { missionAlignment: 96, geographicFocus: 90, programTrackrecord: 88, budgetCapacity: 82, partnershipReadiness: 78 },
      checklist: [], sourceCount: 3, groundedDocumentCount: 0,
    },
    latestDraft: null, latestRevisionRequest: null, approvalRecord: null, submissionRecord: null, followUps: [],
    workflow: { canGenerateDraft: true, canRequestRevision: false, canApprove: false, canSubmit: false, blockingReason: "Grant must be approved before submission" },
    ...overrides,
  };
}

function makeViewModel(overrides: Partial<GrantDrawerViewModel> = {}): GrantDrawerViewModel {
  return {
    grant: null, latestDraftVersionLabel: "No draft yet", latestDraftPreview: "",
    showGenerateDraft: true, showRequestRevision: false, showApprove: false, showSubmit: false,
    submitDisabledReason: "Grant must be approved before submission",
    ...overrides,
  };
}

function makeManifest(overrides: Partial<SubmissionManifest> = {}): SubmissionManifest {
  return { id: "m1", grantId: "g1", version: 1, createdAt: "2026-05-23T08:00:00.000Z", updatedAt: "2026-05-23T08:30:00.000Z", materialRefs: [], ...overrides };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.clearAllMocks();
});

describe("SmartTips", () => {
  const defaultProps = () => {
    const detail = makeDetail();
    const viewModel = makeViewModel();
    return {
      detail, viewModel, manifest: null as SubmissionManifest | null, manifestLoading: false,
      handleGenerateDraft: vi.fn(async () => {}), handleApproveAndLock: vi.fn(async () => {}),
      handleRequestRevision: vi.fn(), setShowSubmitForm: vi.fn(), handleOpenInEditor: vi.fn(),
      handleViewOnGrantsGov: vi.fn(), handleCreateManifest: vi.fn(async () => {}),
      submissionDocuments: [] as DocumentMetadata[],
      handleSubmitComplete: vi.fn(async (_data: unknown) => {}),
      runbookExpanded: false, setRunbookExpanded: vi.fn(), runbookConfirmationNumber: "",
      setRunbookConfirmationNumber: vi.fn(), runbookCompleted: false, setRunbookCompleted: vi.fn(),
      handleSaveRunbook: vi.fn(async () => {}), runbookSaving: false,
    };
  };

  it("renders funder summary section", async () => {
    const detail = makeDetail({ grant: { ...makeDetail().grant, funderSummary: "NSF is a strong fit for community technology access." } });
    root.render(React.createElement(SmartTips, { ...defaultProps(), detail }));
    await waitFor(() => container.textContent?.includes("Funder summary (agent-generated)") === true);
    expect(container.textContent).toContain("NSF is a strong fit for community technology access.");
  });

  it("shows source and grounded document counts", async () => {
    root.render(React.createElement(SmartTips, defaultProps()));
    await waitFor(() => container.textContent?.includes("Sources: 3") === true);
    expect(container.textContent).toContain("Grounded docs: 0");
  });

  it("shows loading state for manifest", async () => {
    const props = defaultProps();
    root.render(React.createElement(SmartTips, { ...props, manifestLoading: true }));
    await waitFor(() => container.textContent?.includes("Loading manifest...") === true);
  });

  it("shows manifest details when manifest exists", async () => {
    const manifest = makeManifest({
      instructions: "Upload all files.", portalUrl: "https://example.org/submit", fileConstraints: "PDF only",
      dueDate: "2026-06-14", notes: "Check budget.",
      materialRefs: [{ documentId: "d1", documentName: "Narrative.pdf", role: "narrative" }, { documentId: "d2", documentName: "Budget.xlsx", version: "v2", role: "budget" }],
    });
    root.render(React.createElement(SmartTips, { ...defaultProps(), manifest }));
    await waitFor(() => container.textContent?.includes("Version 1") === true);
    expect(container.textContent).toContain("Upload all files.");
    expect(container.textContent).toContain("https://example.org/submit");
    expect(container.textContent).toContain("PDF only");
    expect(container.textContent).toContain("2 items");
    expect(container.textContent).toContain("Narrative.pdf");
    expect(container.textContent).toContain("Budget.xlsx (v2)");
  });

  it("shows Create manifest button when no manifest exists", async () => {
    root.render(React.createElement(SmartTips, defaultProps()));
    await waitFor(() => container.textContent?.includes("No submission manifest yet.") === true);
    const createButton = Array.from(container.querySelectorAll("button")).find((btn) => btn.textContent === "Create manifest");
    expect(createButton).not.toBeNull();
  });

  it("calls handleCreateManifest when button is clicked", async () => {
    const handleCreateManifest = vi.fn(async () => {});
    root.render(React.createElement(SmartTips, { ...defaultProps(), handleCreateManifest }));
    await waitFor(() => container.textContent?.includes("Create manifest") === true);
    (Array.from(container.querySelectorAll("button")).find((btn) => btn.textContent === "Create manifest") as HTMLButtonElement)?.click();
    expect(handleCreateManifest).toHaveBeenCalled();
  });

  it("shows Generate draft button when showGenerateDraft is true", async () => {
    root.render(React.createElement(SmartTips, defaultProps()));
    await waitFor(() => container.textContent?.includes("Generate draft") === true);
  });

  it("calls handleGenerateDraft when button is clicked", async () => {
    const handleGenerateDraft = vi.fn(async () => {});
    root.render(React.createElement(SmartTips, { ...defaultProps(), handleGenerateDraft }));
    await waitFor(() => container.textContent?.includes("Generate draft") === true);
    (Array.from(container.querySelectorAll("button")).find((btn) => btn.textContent === "Generate draft") as HTMLButtonElement)?.click();
    expect(handleGenerateDraft).toHaveBeenCalled();
  });

  it("shows Approve & lock button when showApprove is true", async () => {
    const viewModel = makeViewModel({ showApprove: true, showGenerateDraft: false });
    root.render(React.createElement(SmartTips, { ...defaultProps(), viewModel }));
    await waitFor(() => container.textContent?.includes("Approve & lock") === true);
  });

  it("shows Request revision button when showRequestRevision is true", async () => {
    const viewModel = makeViewModel({ showRequestRevision: true, showGenerateDraft: false });
    root.render(React.createElement(SmartTips, { ...defaultProps(), viewModel }));
    await waitFor(() => container.textContent?.includes("Request revision") === true);
  });

  it("shows Submit button when showSubmit is true", async () => {
    const viewModel = makeViewModel({ showSubmit: true, showGenerateDraft: false });
    root.render(React.createElement(SmartTips, { ...defaultProps(), viewModel }));
    await waitFor(() => container.textContent?.includes("Submit") === true);
  });

  it("shows submission blocked reason", async () => {
    root.render(React.createElement(SmartTips, defaultProps()));
    await waitFor(() => container.textContent?.includes("Submission blocked") === true);
  });

  it("does not show submission blocked when canSubmit is true", async () => {
    const detail = makeDetail({ workflow: { canGenerateDraft: false, canRequestRevision: false, canApprove: false, canSubmit: true, blockingReason: null } });
    const viewModel = makeViewModel({ showGenerateDraft: false, showSubmit: true, submitDisabledReason: null });
    root.render(React.createElement(SmartTips, { ...defaultProps(), detail, viewModel }));
    await waitFor(() => container.textContent?.includes("Open in editor") === true);
    expect(container.textContent).not.toContain("Submission blocked");
  });

  it("renders Open in editor and View on grants.gov buttons", async () => {
    root.render(React.createElement(SmartTips, defaultProps()));
    await waitFor(() => container.textContent?.includes("Open in editor") === true);
    expect(container.textContent).toContain("View on grants.gov");
  });

  it("renders submission runbook for submission-ready grants", async () => {
    const detail = makeDetail({ grant: { ...makeDetail().grant, status: "submission-ready" } });
    root.render(React.createElement(SmartTips, { ...defaultProps(), detail }));
    await waitFor(() => container.querySelector("[data-testid='runbook-toggle-btn']") !== null);
  });

  it("does not render runbook for non-submission grants", async () => {
    root.render(React.createElement(SmartTips, defaultProps()));
    await waitFor(() => container.textContent?.includes("Open in editor") === true);
    expect(container.querySelector("[data-testid='runbook-toggle-btn']")).toBeNull();
  });

  it("exposes runbook toggle button with proper aria attributes", async () => {
    const detail = makeDetail({ grant: { ...makeDetail().grant, status: "submission-ready" } });
    root.render(React.createElement(SmartTips, { ...defaultProps(), detail }));
    await waitFor(() => container.querySelector("[data-testid='runbook-toggle-btn']") !== null);
    expect(container.querySelector("[data-testid='runbook-toggle-btn']")?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-testid='runbook-toggle-btn']")?.getAttribute("aria-controls")).toBe("submission-runbook-content");
  });

  it("renders SubmissionReadiness when canSubmit is true", async () => {
    const detail = makeDetail({ workflow: { canGenerateDraft: false, canRequestRevision: false, canApprove: false, canSubmit: true, blockingReason: null } });
    const viewModel = makeViewModel({ showGenerateDraft: false, showSubmit: true, submitDisabledReason: null });
    root.render(React.createElement(SmartTips, { ...defaultProps(), detail, viewModel }));
    await waitFor(() => container.querySelector("[data-testid='submission-readiness']") !== null);
  });
});
