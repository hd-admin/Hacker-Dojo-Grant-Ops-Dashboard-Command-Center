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

import { DuplicatesView } from './DuplicatesView';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

describe('DuplicatesView', () => {
  beforeEach(() => {
    getAll.mockResolvedValue(mockCandidates);
    getGrants.mockResolvedValue(mockGrants);
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

    const header = container.querySelector('[data-testid="duplicates-view-header"]');
    expect(header).not.toBeNull();
    expect(header?.textContent).toContain('Duplicate');
    expect(header?.textContent).toContain('2 pending');
  });

  it('renders empty state when no candidates', async () => {
    getAll.mockResolvedValue([]);
    getGrants.mockResolvedValue([]);

    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const emptyState = container.querySelector('[data-testid="duplicates-empty-state"]');
    expect(emptyState).not.toBeNull();
    expect(emptyState?.textContent).toContain('No duplicate candidates');
  });

  it('renders duplicate cards with confidence bars', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const cards = container.querySelectorAll('[data-testid^="duplicate-card-"]');
    expect(cards.length).toBeGreaterThanOrEqual(3);

    const confidenceBar = container.querySelector('[data-testid="confidence-bar-dup-1"]');
    expect(confidenceBar).not.toBeNull();
  });

  it('displays confidence percentage', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const confidencePct = container.querySelector('[data-testid="confidence-pct-dup-1"]');
    expect(confidencePct).not.toBeNull();
    expect(confidencePct?.textContent).toBe('85%');
  });

  it('shows conflicting fields', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const fields = container.querySelectorAll('[data-testid^="conflicting-field-dup-1-"]');
    expect(fields.length).toBeGreaterThanOrEqual(3);
  });

  it('shows Keep Separate and Merge buttons for pending candidates', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const keepBtn = container.querySelector('[data-testid="keep-separate-btn-dup-1"]');
    expect(keepBtn).not.toBeNull();
    expect(keepBtn?.textContent).toContain('Keep Separate');

    const mergeBtn = container.querySelector('[data-testid="merge-btn-dup-1"]');
    expect(mergeBtn).not.toBeNull();
    expect(mergeBtn?.textContent).toContain('Merge');
  });

  it('does not show action buttons for resolved candidates', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const keepBtn = container.querySelector('[data-testid="keep-separate-btn-dup-3"]');
    expect(keepBtn).toBeNull();

    const mergeBtn = container.querySelector('[data-testid="merge-btn-dup-3"]');
    expect(mergeBtn).toBeNull();
  });

  it('shows resolved status badge', async () => {
    root.render(React.createElement(DuplicatesView, { onGrantSelect: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const statusBadge = container.querySelector('[data-testid="duplicate-status-dup-3"]');
    expect(statusBadge).not.toBeNull();
    expect(statusBadge?.textContent).toBe('kept-separate');
  });

  it('shows grant titles as clickable links', async () => {
    const onGrantSelect = vi.fn();
    root.render(React.createElement(DuplicatesView, { onGrantSelect }));
    await new Promise((r) => setTimeout(r, 100));

    const grantLink = container.querySelector('[data-testid="duplicate-grant-link-1-dup-1"]') as HTMLButtonElement;
    expect(grantLink).not.toBeNull();
    expect(grantLink?.textContent).toContain('NSF Technology Access Grant');

    grantLink?.click();
    expect(onGrantSelect).toHaveBeenCalledWith('grant-1');
  });
});
