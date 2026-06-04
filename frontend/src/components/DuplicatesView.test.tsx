/**
 * DuplicatesView Tests
 *
 * Tests for the duplicate review UI component.
 */

// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { DuplicateCandidate, Grant } from '../../../shared/types';

const mockCandidates: DuplicateCandidate[] = [
  {
    id: 'dup-1',
    grantId1: 'grant-1',
    grantId2: 'grant-2',
    confidenceScore: 0.85,
    status: 'pending',
    detectedAt: '2026-05-28T10:00:00.000Z',
    conflictingFields: ['title', 'funder', 'deadline'],
  },
  {
    id: 'dup-2',
    grantId1: 'grant-3',
    grantId2: 'grant-4',
    confidenceScore: 0.65,
    status: 'pending',
    detectedAt: '2026-05-28T09:00:00.000Z',
    conflictingFields: ['title'],
  },
  {
    id: 'dup-3',
    grantId1: 'grant-5',
    grantId2: 'grant-6',
    confidenceScore: 0.92,
    status: 'kept-separate',
    detectedAt: '2026-05-27T08:00:00.000Z',
    resolvedAt: '2026-05-27T09:00:00.000Z',
    resolvedBy: 'operator',
    conflictingFields: ['title', 'funder', 'amount'],
  },
];

const mockGrants: Grant[] = [
  {
    id: 'grant-1',
    title: 'NSF Technology Access Grant',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$350,000',
    awardSort: 350000,
    deadline: '2026-06-15',
    daysOut: 25,
    fit: 88,
    tags: ['Tech'],
    status: 'matched',
    statusLabel: 'Matched',
  },
  {
    id: 'grant-2',
    title: 'NSF Tech Access Program',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$350,000',
    awardSort: 350000,
    deadline: '2026-06-18',
    daysOut: 28,
    fit: 85,
    tags: ['Tech'],
    status: 'matched',
    statusLabel: 'Matched',
  },
  {
    id: 'grant-3',
    title: 'Community Foundation Grant',
    funder: 'Silicon Valley Community Foundation',
    funderShort: 'SVCF',
    award: '$75,000',
    awardSort: 75000,
    deadline: '2026-07-01',
    daysOut: 40,
    fit: 82,
    tags: ['Community'],
    status: 'matched',
    statusLabel: 'Matched',
  },
  {
    id: 'grant-4',
    title: 'City Community Grant',
    funder: 'City of Mountain View',
    funderShort: 'CMV',
    award: '$50,000',
    awardSort: 50000,
    deadline: '2026-07-15',
    daysOut: 54,
    fit: 70,
    tags: ['Community'],
    status: 'matched',
    statusLabel: 'Matched',
  },
  {
    id: 'grant-5',
    title: 'STEM Education Fund',
    funder: 'Tech Foundation',
    funderShort: 'TF',
    award: '$100,000',
    awardSort: 100000,
    deadline: '2026-08-01',
    daysOut: 70,
    fit: 90,
    tags: ['EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
  },
  {
    id: 'grant-6',
    title: 'STEM Education Scholarship',
    funder: 'Tech Foundation',
    funderShort: 'TF',
    award: '$150,000',
    awardSort: 150000,
    deadline: '2026-08-05',
    daysOut: 74,
    fit: 88,
    tags: ['EdTech'],
    status: 'matched',
    statusLabel: 'Matched',
  },
];

const { getAll, resolve, getGrants } = vi.hoisted(() => ({
  getAll: vi.fn(),
  resolve: vi.fn(),
  getGrants: vi.fn(),
}));

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    duplicates: { getAll: getAll, resolve: resolve },
    grants: { getAll: getGrants },
  },
}));

import { getByRole, getByText } from '../test-helpers';
import { DuplicatesView } from './DuplicatesView';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

describe('DuplicatesView', () => {
  beforeEach(() => {
    getAll.mockResolvedValue(mockCandidates);
    getGrants.mockResolvedValue({ items: mockGrants });
    resolve.mockImplementation(async () => ({ ...mockCandidates[0]!, status: 'kept-separate' }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders the header with pending count', async () => {
    await act(async () => {
      root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(container.textContent).toContain('Duplicate');
    expect(container.textContent).toContain('2 pending');
  });

  it('renders empty state when no candidates', async () => {
    getAll.mockResolvedValue([]);
    getGrants.mockResolvedValue({ items: [] });

    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const emptyState = getByText(container, 'No duplicate candidates');
    expect(emptyState).not.toBeNull();
  });

  it('renders duplicate cards with confidence bars', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    expect(container.textContent).toContain('NSF Technology Access Grant');
    expect(container.textContent).toContain('Community Foundation Grant');

    const progressbars = Array.from(container.querySelectorAll('[role="progressbar"]'));
    expect(progressbars.length).toBeGreaterThanOrEqual(1);
  });

  it('displays confidence percentage', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    expect(container.textContent).toContain('85%');
  });

  it('shows conflicting fields', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    expect(container.textContent).toContain('title');
    expect(container.textContent).toContain('funder');
    expect(container.textContent).toContain('deadline');
  });

  it('shows Keep Separate and Merge buttons for pending candidates', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const keepBtn = getByRole(container, 'button', { name: 'Keep Separate' });
    expect(keepBtn).not.toBeNull();

    const mergeBtn = getByRole(container, 'button', { name: 'Merge' });
    expect(mergeBtn).not.toBeNull();
  });

  it('does not show action buttons for resolved candidates', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const resolvedCard = Array.from(container.querySelectorAll('[role="listitem"]')).find((el) =>
      el.textContent?.includes('kept-separate'),
    );
    expect(resolvedCard).not.toBeNull();
    const buttonsInResolved = resolvedCard?.querySelectorAll('button');
    expect(buttonsInResolved?.length ?? 0).toBe(0);
  });

  it('shows resolved status badge', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    expect(container.textContent).toContain('kept-separate');
  });

  it('shows grant titles as clickable links', async () => {
    const onGrantSelect = vi.fn();
    root.render(React.createElement(DuplicatesView, { onGrantSelect }));
    await new Promise((r) => setTimeout(r, 100));

    const grantLink = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('NSF Technology Access Grant'),
    ) as HTMLButtonElement;
    expect(grantLink).not.toBeNull();

    grantLink?.click();
    expect(onGrantSelect).toHaveBeenCalledWith('grant-1');
  });
});
