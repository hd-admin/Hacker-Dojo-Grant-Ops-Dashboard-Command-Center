// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRoot } from "next/dist/compiled/react-dom/client";
import type { FitScoreBreakdown as FitScoreBreakdownType } from "../../../../shared/types";
import { FitScoreBreakdown } from "./FitScoreBreakdown";

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for condition");
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function makeBreakdown(overrides: Partial<FitScoreBreakdownType> = {}): FitScoreBreakdownType {
  return { missionAlignment: 96, geographicFocus: 90, programTrackrecord: 88, budgetCapacity: 82, partnershipReadiness: 78, ...overrides };
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

describe("FitScoreBreakdown", () => {
  it("renders all five dimensions with correct labels and scores", async () => {
    const breakdown = makeBreakdown();
    root.render(React.createElement(FitScoreBreakdown, { fitBreakdown: breakdown }));
    await waitFor(() => container.querySelectorAll(".fit-row-val").length === 5);

    const labels = Array.from(container.querySelectorAll(".fit-row-label")).map((n) => n.textContent);
    expect(labels).toEqual(["Mission alignment", "Geographic focus", "Program track record", "Budget capacity", "Partnership readiness"]);

    const values = Array.from(container.querySelectorAll(".fit-row-val")).map((n) => n.textContent);
    expect(values).toEqual(["96", "90", "88", "82", "78"]);
  });

  it("renders the section heading with accessible text", async () => {
    const breakdown = makeBreakdown();
    root.render(React.createElement(FitScoreBreakdown, { fitBreakdown: breakdown }));
    await waitFor(() => container.querySelector("h3") !== null);
    expect(container.querySelector("h3")?.textContent).toBe("Why it fits");
  });

  it("renders score bars proportional to score values", async () => {
    const breakdown = makeBreakdown({ missionAlignment: 50, geographicFocus: 0, programTrackrecord: 100, budgetCapacity: 75, partnershipReadiness: 25 });
    root.render(React.createElement(FitScoreBreakdown, { fitBreakdown: breakdown }));
    await waitFor(() => container.querySelectorAll(".fit-row-bar > div").length === 5);

    const bars = container.querySelectorAll(".fit-row-bar > div");
    expect(bars.length).toBe(5);
    expect((bars[1] as HTMLElement).style.transform).toBe("scaleX(0)");
    expect((bars[2] as HTMLElement).style.transform).toBe("scaleX(1)");
  });

  it("renders correctly with boundary scores", async () => {
    const breakdown = makeBreakdown({ missionAlignment: 0, geographicFocus: 100, programTrackrecord: 50, budgetCapacity: 1, partnershipReadiness: 99 });
    root.render(React.createElement(FitScoreBreakdown, { fitBreakdown: breakdown }));
    await waitFor(() => container.querySelectorAll(".fit-row-val").length === 5);

    const values = Array.from(container.querySelectorAll(".fit-row-val")).map((n) => n.textContent);
    expect(values).toEqual(["0", "100", "50", "1", "99"]);
  });
});
