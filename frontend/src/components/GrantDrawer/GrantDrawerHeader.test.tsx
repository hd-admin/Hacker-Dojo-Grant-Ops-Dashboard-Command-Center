// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { GrantDetailResponse } from '../../../../shared/types';
import { GrantDrawerHeader } from './GrantDrawerHeader';

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function makeGrant(
  details: Partial<GrantDetailResponse['grant']> = {},
): GrantDetailResponse['grant'] {
  return {
    id: 'g1',
    title: 'Test Grant Title',
    funder: 'Test Foundation',
    funderShort: 'TF',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 88,
    tags: ['Education'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-19',
    fitBreakdown: {
      missionAlignment: 96,
      geographicFocus: 90,
      programTrackrecord: 88,
      budgetCapacity: 82,
      partnershipReadiness: 78,
    },
    checklist: [],
    sourceCount: 3,
    groundedDocumentCount: 0,
    ...details,
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

describe('GrantDrawerHeader', () => {
  it('renders grant title, funder, award, deadline, fit score, and status', async () => {
    const grant = makeGrant();
    root.render(React.createElement(GrantDrawerHeader, { grant, onClose: () => {} }));
    await waitFor(() => container.textContent?.includes('Test Grant Title') === true);
    expect(container.textContent).toContain('Test Foundation');
    expect(container.textContent).toContain('$100,000');
    expect(container.textContent).toContain('88');
    expect(container.textContent).toContain('Matched');
  });

  it('renders close button with accessible label', async () => {
    const grant = makeGrant();
    root.render(React.createElement(GrantDrawerHeader, { grant, onClose: () => {} }));
    await waitFor(() => container.querySelector("[aria-label='Close']") !== null);
    const closeButton = container.querySelector("[aria-label='Close']");
    expect(closeButton?.tagName).toBe('BUTTON');
  });

  it('calls onClose when close button is clicked', async () => {
    let closed = false;
    const grant = makeGrant();
    root.render(
      React.createElement(GrantDrawerHeader, {
        grant,
        onClose: () => {
          closed = true;
        },
      }),
    );
    await waitFor(() => container.querySelector("[aria-label='Close']") !== null);
    (container.querySelector("[aria-label='Close']") as HTMLButtonElement)?.click();
    expect(closed).toBe(true);
  });

  it('shows (estimated) badge when deadlineConfidence is estimated', async () => {
    const grant = makeGrant({ deadlineConfidence: 'estimated' });
    root.render(React.createElement(GrantDrawerHeader, { grant, onClose: () => {} }));
    await waitFor(
      () => container.querySelector("[data-testid='deadline-confidence-badge']") !== null,
    );
    expect(container.querySelector("[data-testid='deadline-confidence-badge']")?.textContent).toBe(
      '(estimated)',
    );
  });

  it('shows (date uncertain) badge when deadlineConfidence is unknown', async () => {
    const grant = makeGrant({ deadlineConfidence: 'unknown' });
    root.render(React.createElement(GrantDrawerHeader, { grant, onClose: () => {} }));
    await waitFor(
      () => container.querySelector("[data-testid='deadline-confidence-badge']") !== null,
    );
    expect(container.querySelector("[data-testid='deadline-confidence-badge']")?.textContent).toBe(
      '(date uncertain)',
    );
  });

  it('renders no confidence badge when deadlineConfidence is exact or undefined', async () => {
    const grant = makeGrant({ deadlineConfidence: 'exact' });
    root.render(React.createElement(GrantDrawerHeader, { grant, onClose: () => {} }));
    await waitFor(() => container.textContent?.includes('Test Grant Title') === true);
    expect(container.querySelector("[data-testid='deadline-confidence-badge']")).toBeNull();
  });

  it('shows human-confirmed badge when fit has human overrides', async () => {
    const grant = makeGrant({
      humanOverrides: [
        {
          field: 'fit',
          previousValue: 88,
          newValue: 91,
          rationale: 'Reviewed',
          overriddenAt: '2026-01-01T00:00:00Z',
          overriddenBy: 'operator',
          overrideType: 'score',
        },
      ],
    });
    root.render(React.createElement(GrantDrawerHeader, { grant, onClose: () => {} }));
    await waitFor(
      () => container.querySelector("[data-testid='fit-human-confirmed-badge']") !== null,
    );
    expect(
      container.querySelector("[data-testid='fit-human-confirmed-badge']")?.textContent,
    ).toContain('Human-confirmed');
  });

  it('renders category when present', async () => {
    const grant = makeGrant({ category: 'Education' });
    root.render(React.createElement(GrantDrawerHeader, { grant, onClose: () => {} }));
    await waitFor(() => container.textContent?.includes('Category') === true);
    expect(container.textContent).toContain('Education');
  });

  it('renders Rolling deadline as-is without formatting', async () => {
    const grant = makeGrant({ deadline: 'Rolling' });
    root.render(React.createElement(GrantDrawerHeader, { grant, onClose: () => {} }));
    await waitFor(() => container.textContent?.includes('Rolling') === true);
    expect(container.textContent).toContain('Rolling');
  });

  it('renders Archive and Delete buttons when callbacks are provided', async () => {
    let archived = false;
    let deleted = false;
    const grant = makeGrant();
    root.render(
      React.createElement(GrantDrawerHeader, {
        grant,
        onClose: () => {},
        onArchive: () => {
          archived = true;
        },
        onDelete: () => {
          deleted = true;
        },
      }),
    );
    await waitFor(
      () => container.querySelector("[data-testid='grant-archive-btn']") !== null,
    );
    (container.querySelector("[data-testid='grant-archive-btn']") as HTMLButtonElement)?.click();
    (container.querySelector("[data-testid='grant-delete-btn']") as HTMLButtonElement)?.click();
    expect(archived).toBe(true);
    expect(deleted).toBe(true);
  });

  it('renders Last seen and Updated meta items with relative-time text', async () => {
    const grant = makeGrant({
      lastSeenAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      lastUpdatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    root.render(React.createElement(GrantDrawerHeader, { grant, onClose: () => {} }));
    await waitFor(
      () => container.querySelector("[data-testid='header-last-seen-text']") !== null,
    );
    const lastSeen = container.querySelector("[data-testid='header-last-seen-text']");
    const lastUpdated = container.querySelector("[data-testid='header-last-updated-text']");
    expect(lastSeen?.textContent).toBe('3h ago');
    expect(lastUpdated?.textContent).toBe('yesterday');
  });
});
