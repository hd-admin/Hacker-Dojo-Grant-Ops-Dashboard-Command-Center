// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "next/dist/compiled/react-dom/client";
import type { DraftArtifact } from "../../../../shared/types";
import { UngroundedClaimsWarning } from "./UngroundedClaimsWarning";

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for condition");
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function makeDraft(overrides: Partial<DraftArtifact> = {}): DraftArtifact {
  return {
    id: "draft-1", grantId: "g1", version: 1, content: "Test content",
    createdAt: "2026-05-23T10:00:00.000Z", createdBy: "agent",
    groundingSections: [
      { sectionTitle: "Executive Summary", evidence: ["Doc A"], isGrounded: true },
      { sectionTitle: "Budget", evidence: [], isGrounded: false },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

describe("UngroundedClaimsWarning", () => {
  const defaultProps = () => ({
    showGroundingWarning: false, groundingOverrideConfirmed: false,
    setGroundingOverrideConfirmed: vi.fn(), doApproveAndLock: vi.fn(async () => {}),
    setShowGroundingWarning: vi.fn(), latestDraft: null as DraftArtifact | null,
  });

  it("renders nothing when showGroundingWarning is false", () => {
    root.render(React.createElement(UngroundedClaimsWarning, defaultProps()));
    expect(container.querySelector("[data-testid='grounding-warning-dialog']")).toBeNull();
  });

  it("renders nothing when there is no latest draft", () => {
    root.render(React.createElement(UngroundedClaimsWarning, { ...defaultProps(), showGroundingWarning: true }));
    expect(container.querySelector("[data-testid='grounding-warning-dialog']")).toBeNull();
  });

  it("renders warning dialog when showGroundingWarning is true and draft exists", async () => {
    const latestDraft = makeDraft();
    root.render(React.createElement(UngroundedClaimsWarning, { ...defaultProps(), showGroundingWarning: true, latestDraft }));
    await waitFor(() => container.querySelector("[data-testid='grounding-warning-dialog']") !== null);
    const dialog = container.querySelector("[data-testid='grounding-warning-dialog']");
    expect(dialog?.getAttribute("role")).toBe("alert");
    expect(dialog?.textContent).toContain("Ungrounded Claims Detected");
  });

  it("lists only ungrounded sections", async () => {
    const latestDraft = makeDraft({
      groundingSections: [
        { sectionTitle: "Executive Summary", evidence: ["Doc A"], isGrounded: true },
        { sectionTitle: "Budget", evidence: [], isGrounded: false },
        { sectionTitle: "Methodology", evidence: [], isGrounded: false },
      ],
    });
    root.render(React.createElement(UngroundedClaimsWarning, { ...defaultProps(), showGroundingWarning: true, latestDraft }));
    await waitFor(() => container.textContent?.includes("Budget") === true);
    expect(container.textContent).toContain("Methodology");
    expect(container.textContent).not.toContain("Executive Summary — no evidence found");
  });

  it("Approve Anyway button is disabled until checkbox is checked", async () => {
    const latestDraft = makeDraft();
    root.render(React.createElement(UngroundedClaimsWarning, { ...defaultProps(), showGroundingWarning: true, latestDraft, groundingOverrideConfirmed: false }));
    await waitFor(() => container.querySelector("[data-testid='grounding-approve-anyway-btn']") !== null);
    expect((container.querySelector("[data-testid='grounding-approve-anyway-btn']") as HTMLButtonElement)?.disabled).toBe(true);
  });

  it("Approve Anyway button is enabled when checkbox is checked", async () => {
    const latestDraft = makeDraft();
    root.render(React.createElement(UngroundedClaimsWarning, { ...defaultProps(), showGroundingWarning: true, latestDraft, groundingOverrideConfirmed: true }));
    await waitFor(() => container.querySelector("[data-testid='grounding-approve-anyway-btn']") !== null);
    expect((container.querySelector("[data-testid='grounding-approve-anyway-btn']") as HTMLButtonElement)?.disabled).toBe(false);
  });

  it("checkbox toggle calls setGroundingOverrideConfirmed", async () => {
    const setGroundingOverrideConfirmed = vi.fn();
    const latestDraft = makeDraft();
    root.render(React.createElement(UngroundedClaimsWarning, { ...defaultProps(), showGroundingWarning: true, latestDraft, setGroundingOverrideConfirmed }));
    await waitFor(() => container.querySelector("[data-testid='grounding-override-checkbox']") !== null);
    (container.querySelector("[data-testid='grounding-override-checkbox']") as HTMLInputElement)?.click();
    expect(setGroundingOverrideConfirmed).toHaveBeenCalledWith(true);
  });

  it("Cancel button dismisses the dialog", async () => {
    const setShowGroundingWarning = vi.fn();
    const latestDraft = makeDraft();
    root.render(React.createElement(UngroundedClaimsWarning, { ...defaultProps(), showGroundingWarning: true, latestDraft, setShowGroundingWarning }));
    await waitFor(() => container.textContent?.includes("Cancel") === true);
    (Array.from(container.querySelectorAll("button")).find((btn) => btn.textContent === "Cancel") as HTMLButtonElement)?.click();
    expect(setShowGroundingWarning).toHaveBeenCalledWith(false);
  });

  it("Approve Anyway button calls doApproveAndLock when clicked", async () => {
    const doApproveAndLock = vi.fn(async () => {});
    const latestDraft = makeDraft();
    root.render(React.createElement(UngroundedClaimsWarning, { ...defaultProps(), showGroundingWarning: true, latestDraft, groundingOverrideConfirmed: true, doApproveAndLock }));
    await waitFor(() => container.querySelector("[data-testid='grounding-approve-anyway-btn']") !== null);
    (container.querySelector("[data-testid='grounding-approve-anyway-btn']") as HTMLButtonElement)?.click();
    expect(doApproveAndLock).toHaveBeenCalled();
  });

  it("shows 'I understand. Approve anyway' checkbox label", async () => {
    const latestDraft = makeDraft();
    root.render(React.createElement(UngroundedClaimsWarning, { ...defaultProps(), showGroundingWarning: true, latestDraft }));
    await waitFor(() => container.textContent?.includes("I understand. Approve anyway") === true);
  });
});
