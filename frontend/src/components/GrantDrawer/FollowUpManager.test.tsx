// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "next/dist/compiled/react-dom/client";
import type { FollowUp } from "../../../../shared/types";
import { FollowUpManager } from "./FollowUpManager";

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for condition");
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function makeFollowUp(overrides: Partial<FollowUp> = {}): FollowUp {
  return {
    id: "fu-1", grantId: "g1", type: "progress_check", title: "Check status of application",
    description: "Follow up with NSF on status.", dueDate: "2026-06-06T00:00:00.000Z",
    status: "pending", createdAt: "2026-05-23T13:00:00.000Z", ...overrides,
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

describe("FollowUpManager", () => {
  const defaultProps = () => ({
    followUps: [] as FollowUp[], followUpsLoading: false, showFollowUpForm: false,
    setShowFollowUpForm: vi.fn(), newFollowUpType: "other" as FollowUp["type"],
    setNewFollowUpType: vi.fn(), newFollowUpTitle: "", setNewFollowUpTitle: vi.fn(),
    newFollowUpDescription: "", setNewFollowUpDescription: vi.fn(),
    newFollowUpDueDate: "", setNewFollowUpDueDate: vi.fn(),
    handleCreateFollowUp: vi.fn(async () => {}),
    handleMarkComplete: vi.fn(async (_fu: FollowUp) => {}),
    handleDeleteFollowUp: vi.fn(async (_id: string) => {}),
    showOutcomeForm: false, outcomeNotes: "", setOutcomeNotes: vi.fn(),
    handleSaveOutcome: vi.fn(async () => {}), setShowOutcomeForm: vi.fn(),
    detail: null as { grant: { statusLabel: string; id: string } } | null,
  });

  it("renders the follow-ups section heading", async () => {
    root.render(React.createElement(FollowUpManager, defaultProps()));
    await waitFor(() => container.querySelector("h3") !== null);
    expect(container.querySelector("h3")?.textContent).toBe("Follow-ups");
  });

  it("shows add follow-up button with accessible label", async () => {
    root.render(React.createElement(FollowUpManager, defaultProps()));
    await waitFor(() => container.querySelector("[aria-label='Add follow-up']") !== null);
  });

  it("toggles follow-up form display", async () => {
    const setShowFollowUpForm = vi.fn();
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), setShowFollowUpForm }));
    await waitFor(() => container.querySelector("[data-testid='add-follow-up-btn']") !== null);
    (container.querySelector("[data-testid='add-follow-up-btn']") as HTMLButtonElement)?.click();
    expect(setShowFollowUpForm).toHaveBeenCalledWith(true);
  });

  it("shows follow-up form when showFollowUpForm is true", async () => {
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), showFollowUpForm: true }));
    await waitFor(() => container.querySelector("[data-testid='follow-up-create-form']") !== null);
    expect(container.querySelector("select[aria-label='Follow-up type']")).not.toBeNull();
    expect(container.querySelector("input[aria-label='Follow-up title']")).not.toBeNull();
    expect(container.querySelector("textarea[aria-label='Follow-up description']")).not.toBeNull();
  });

  it("disables save button when title is empty", async () => {
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), showFollowUpForm: true, newFollowUpTitle: "" }));
    await waitFor(() => container.querySelector("[data-testid='save-follow-up-btn']") !== null);
    expect((container.querySelector("[data-testid='save-follow-up-btn']") as HTMLButtonElement)?.disabled).toBe(true);
  });

  it("enables save button when title is non-empty", async () => {
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), showFollowUpForm: true, newFollowUpTitle: "Test" }));
    await waitFor(() => container.querySelector("[data-testid='save-follow-up-btn']") !== null);
    expect((container.querySelector("[data-testid='save-follow-up-btn']") as HTMLButtonElement)?.disabled).toBe(false);
  });

  it("shows loading state for follow-ups", async () => {
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), followUpsLoading: true }));
    await waitFor(() => container.textContent?.includes("Loading follow-ups...") === true);
  });

  it("shows empty state when no follow-ups exist", async () => {
    root.render(React.createElement(FollowUpManager, defaultProps()));
    await waitFor(() => container.textContent?.includes("No follow-ups yet") === true);
  });

  it("renders follow-up items with status badges", async () => {
    const followUps = [makeFollowUp()];
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), followUps }));
    await waitFor(() => container.querySelector("[data-testid='follow-up-item-fu-1']") !== null);
    expect(container.querySelector("[data-testid='follow-up-item-fu-1']")?.textContent).toContain("Check status of application");
  });

  it("shows overdue badge when follow-up is past due date", async () => {
    const followUps = [makeFollowUp({ dueDate: "2020-01-01T00:00:00.000Z", status: "pending" })];
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), followUps }));
    await waitFor(() => container.textContent?.includes("OVERDUE") === true);
  });

  it("shows mark-complete button with accessible label", async () => {
    const followUps = [makeFollowUp()];
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), followUps }));
    await waitFor(() => container.querySelector("[aria-label='Mark \"Check status of application\" as complete']") !== null);
  });

  it("calls handleMarkComplete when mark-complete button is clicked", async () => {
    const followUps = [makeFollowUp()];
    const handleMarkComplete = vi.fn(async () => {});
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), followUps, handleMarkComplete }));
    await waitFor(() => container.querySelector("[data-testid='mark-complete-btn-fu-1']") !== null);
    (container.querySelector("[data-testid='mark-complete-btn-fu-1']") as HTMLButtonElement)?.click();
    expect(handleMarkComplete).toHaveBeenCalledWith(followUps[0]);
  });

  it("shows delete button with accessible label", async () => {
    const followUps = [makeFollowUp()];
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), followUps }));
    await waitFor(() => container.querySelector("[aria-label='Delete \"Check status of application\"']") !== null);
  });

  it("calls handleDeleteFollowUp when delete button is clicked", async () => {
    const followUps = [makeFollowUp()];
    const handleDeleteFollowUp = vi.fn(async () => {});
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), followUps, handleDeleteFollowUp }));
    await waitFor(() => container.querySelector("[data-testid='delete-follow-up-btn-fu-1']") !== null);
    (container.querySelector("[data-testid='delete-follow-up-btn-fu-1']") as HTMLButtonElement)?.click();
    expect(handleDeleteFollowUp).toHaveBeenCalledWith("fu-1");
  });

  it("shows outcome form when showOutcomeForm is true and detail is provided", async () => {
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), showOutcomeForm: true, detail: { grant: { statusLabel: "Awarded", id: "g1" } } }));
    await waitFor(() => container.querySelector("[data-testid='outcome-tracking-form']") !== null);
  });

  it("shows correct status label in the outcome form", async () => {
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), showOutcomeForm: true, detail: { grant: { statusLabel: "Awarded", id: "g1" } } }));
    await waitFor(() => container.textContent?.includes("Awarded") === true);
  });

  it("calls handleSaveOutcome when save outcome button is clicked", async () => {
    const handleSaveOutcome = vi.fn(async () => {});
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), showOutcomeForm: true, handleSaveOutcome, outcomeNotes: "Done.", detail: { grant: { statusLabel: "Awarded", id: "g1" } } }));
    await waitFor(() => container.querySelector("[data-testid='save-outcome-btn']") !== null);
    (container.querySelector("[data-testid='save-outcome-btn']") as HTMLButtonElement)?.click();
    expect(handleSaveOutcome).toHaveBeenCalled();
  });

  it("disables save outcome button when notes are empty", async () => {
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), showOutcomeForm: true, outcomeNotes: "", detail: { grant: { statusLabel: "Awarded", id: "g1" } } }));
    await waitFor(() => container.querySelector("[data-testid='save-outcome-btn']") !== null);
    expect((container.querySelector("[data-testid='save-outcome-btn']") as HTMLButtonElement)?.disabled).toBe(true);
  });

  it("Dismiss button hides the outcome form", async () => {
    const setShowOutcomeForm = vi.fn();
    const setOutcomeNotes = vi.fn();
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), showOutcomeForm: true, setShowOutcomeForm, setOutcomeNotes, detail: { grant: { statusLabel: "Awarded", id: "g1" } } }));
    await waitFor(() => container.textContent?.includes("Dismiss") === true);
    (Array.from(container.querySelectorAll("button")).find((btn) => btn.textContent === "Dismiss") as HTMLButtonElement)?.click();
    expect(setShowOutcomeForm).toHaveBeenCalledWith(false);
    expect(setOutcomeNotes).toHaveBeenCalledWith("");
  });

  it("hides mark-complete button for completed follow-ups", async () => {
    const followUps = [makeFollowUp({ status: "completed", completedAt: "2026-05-23T14:00:00Z" })];
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), followUps }));
    await waitFor(() => container.querySelector("[data-testid='follow-up-item-fu-1']") !== null);
    expect(container.querySelector("[data-testid='mark-complete-btn-fu-1']")).toBeNull();
  });

  it("sorts follow-ups with overdue first", async () => {
    const followUps: FollowUp[] = [
      makeFollowUp({ id: "fu-1", status: "completed", title: "Third" }),
      makeFollowUp({ id: "fu-2", status: "pending", title: "Second", dueDate: "2026-07-01T00:00:00Z" }),
      makeFollowUp({ id: "fu-3", status: "pending", title: "First", dueDate: "2020-01-01T00:00:00Z" }),
    ];
    root.render(React.createElement(FollowUpManager, { ...defaultProps(), followUps }));
    await waitFor(() => container.querySelector("[data-testid='follow-up-item-fu-1']") !== null);
    const items = container.querySelectorAll("[data-testid^='follow-up-item-']");
    expect(items.length).toBe(3);
    const ids = Array.from(items).map((el) => el.getAttribute("data-testid"));
    expect(ids[0]).toContain("fu-3");
    expect(ids[1]).toContain("fu-2");
    expect(ids[2]).toContain("fu-1");
  });
});
