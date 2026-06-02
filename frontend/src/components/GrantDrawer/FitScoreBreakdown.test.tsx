// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { getByRole, getAllByRole, queryByRole } from '../../test-helpers';
import type { FitScoreBreakdown as FitScoreBreakdownType } from '../../../../shared/types';
import { FitScoreBreakdown } from './FitScoreBreakdown';

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function makeBreakdown(overrides: Partial<FitScoreBreakdownType> = {}): FitScoreBreakdownType {
  return {
    missionAlignment: 96,
    geographicFocus: 90,
    programTrackrecord: 88,
    budgetCapacity: 82,
    partnershipReadiness: 78,
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
});

describe('FitScoreBreakdown', () => {
  it('renders all five dimensions with correct labels and scores', async () => {
    const breakdown = makeBreakdown();
    root.render(React.createElement(FitScoreBreakdown, { fitBreakdown: breakdown }));
    await waitFor(() => getAllByRole(container, 'listitem').length === 5);

    const items = getAllByRole(container, 'listitem');
    expect(items.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Mission alignment: 96 percent',
      'Geographic focus: 90 percent',
      'Program track record: 88 percent',
      'Budget capacity: 82 percent',
      'Partnership readiness: 78 percent',
    ]);
  });

  it('renders the section heading with accessible text', async () => {
    const breakdown = makeBreakdown();
    root.render(React.createElement(FitScoreBreakdown, { fitBreakdown: breakdown }));
    await waitFor(() => queryByRole(container, 'heading', { name: 'Why it fits' }) !== null);
    expect(getByRole(container, 'heading', { name: 'Why it fits' }).textContent).toBe(
      'Why it fits',
    );
  });

  it('renders score bars proportional to score values', async () => {
    const breakdown = makeBreakdown({
      missionAlignment: 50,
      geographicFocus: 0,
      programTrackrecord: 100,
      budgetCapacity: 75,
      partnershipReadiness: 25,
    });
    root.render(React.createElement(FitScoreBreakdown, { fitBreakdown: breakdown }));
    await waitFor(() => getAllByRole(container, 'listitem').length === 5);

    const items = getAllByRole(container, 'listitem');
    expect(items.length).toBe(5);
    const bars = items.map((r) => r.querySelector('[style*="transform"]') as HTMLElement);
    expect(bars[1]?.style.transform).toBe('scaleX(0)');
    expect(bars[2]?.style.transform).toBe('scaleX(1)');
  });

  it('renders correctly with boundary scores', async () => {
    const breakdown = makeBreakdown({
      missionAlignment: 0,
      geographicFocus: 100,
      programTrackrecord: 50,
      budgetCapacity: 1,
      partnershipReadiness: 99,
    });
    root.render(React.createElement(FitScoreBreakdown, { fitBreakdown: breakdown }));
    await waitFor(() => getAllByRole(container, 'listitem').length === 5);

    const items = getAllByRole(container, 'listitem');
    expect(items.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Mission alignment: 0 percent',
      'Geographic focus: 100 percent',
      'Program track record: 50 percent',
      'Budget capacity: 1 percent',
      'Partnership readiness: 99 percent',
    ]);
  });
});
