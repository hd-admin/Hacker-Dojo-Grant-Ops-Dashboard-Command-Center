// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { Grant, Source } from '../../../shared/types';

const { mockGetAllGrants, mockGetAllSources, mockGetRuns } = vi.hoisted(() => ({
  mockGetAllGrants: vi.fn(),
  mockGetAllSources: vi.fn(),
  mockGetRuns: vi.fn(),
}));

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    grants: { getAll: mockGetAllGrants },
    sources: { getAll: mockGetAllSources },
    research: { getRuns: mockGetRuns },
  },
}));

import { getByRole, queryByRole } from '../test-helpers';
import { DiscoveryView } from './DiscoveryView';

const mockGrants: Grant[] = [
  {
    id: 'grant-1',
    title: 'NSF STEM Education Grant',
    funder: 'National Science Foundation',
    funderShort: 'NSF',
    award: '$500,000',
    awardSort: 500000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 92,
    tags: ['Science & Tech', 'Federal'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-20',
    deadlineConfidence: 'exact',
  },
  {
    id: 'grant-2',
    title: 'Community Innovation Fund',
    funder: 'Candid Foundation',
    funderShort: 'Candid',
    award: '$75,000',
    awardSort: 75000,
    deadline: 'Rolling',
    daysOut: 0,
    fit: 85,
    tags: ['Community', 'Foundation'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-21',
    deadlineConfidence: 'rolling',
  },
  {
    id: 'grant-3',
    title: 'EdTech Accelerator',
    funder: 'Google.org',
    funderShort: 'Google',
    award: '$250,000',
    awardSort: 250000,
    deadline: '2026-08-15',
    daysOut: 60,
    fit: 78,
    tags: ['EdTech', 'Corporate'],
    status: 'matched',
    statusLabel: 'Matched',
    matchedAt: '2026-05-22',
    deadlineConfidence: 'exact',
  },
];

const mockSources: Source[] = [
  {
    id: 'source-1',
    name: 'Grants.gov',
    url: 'https://grants.gov',
    type: 'website',
    reviewStatus: 'approved',
    suggestedBy: 'system',
    sourceCrawlState: 'succeeded',
    lastCrawledAt: '2026-05-30T00:00:00Z',
    createdAt: '2026-05-01T00:00:00Z',
    isActive: true,
    crawlAccessCategory: 'crawlable',
  },
];

describe('DiscoveryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllGrants.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    mockGetAllSources.mockResolvedValue([]);
    mockGetRuns.mockResolvedValue({ latestRun: null, allRuns: [] });
    if (typeof window.localStorage?.clear === 'function') {
      window.localStorage.clear();
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders empty state when no grants provided', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiscoveryView, {
        onGrantSelect: () => {},
      }),
    );
    await vi.waitFor(() => expect(container.textContent).toContain('No grants discovered yet'), {
      timeout: 5000,
    });
    root.unmount();
    container.remove();
  });

  it('renders grant list when grants are provided', async () => {
    mockGetAllGrants.mockResolvedValue({ items: mockGrants, total: mockGrants.length, page: 1, pageSize: 25 });
    mockGetAllSources.mockResolvedValue(mockSources);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiscoveryView, {
        onGrantSelect: () => {},
        grants: mockGrants,
        sources: mockSources,
      }),
    );
    await vi.waitFor(() => expect(container.textContent).toContain('NSF STEM Education Grant'), {
      timeout: 5000,
    });
    expect(container.textContent).toContain('NSF STEM Education Grant');
    expect(container.textContent).toContain('Community Innovation Fund');
    expect(container.textContent).toContain('EdTech Accelerator');
    expect(container.textContent).toContain('NSF');
    expect(container.textContent).toContain('Candid');
    root.unmount();
    container.remove();
  });

  it('filters grants by search query', { timeout: 10000 }, async () => {
    mockGetAllGrants.mockResolvedValue({ items: mockGrants, total: mockGrants.length, page: 1, pageSize: 25 });
    mockGetAllSources.mockResolvedValue(mockSources);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiscoveryView, {
        onGrantSelect: () => {},
        grants: mockGrants,
        sources: mockSources,
      }),
    );
    await vi.waitFor(() => expect(container.textContent).toContain('3 grants'), { timeout: 5000 });

    const searchInput = getByRole(container, 'textbox', {
      name: 'Search grants, funders, and tags',
    }) as HTMLInputElement;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(searchInput, 'NSF');
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => expect(container.textContent).toContain('1 grants'), { timeout: 5000 });
    expect(container.textContent).toContain('NSF STEM Education Grant');
    expect(container.textContent).not.toContain('Community Innovation Fund');
    expect(container.textContent).not.toContain('EdTech Accelerator');
    root.unmount();
    container.remove();
  });

  it('shows filter empty state when no grants match', { timeout: 10000 }, async () => {
    mockGetAllGrants.mockResolvedValue({ items: mockGrants, total: mockGrants.length, page: 1, pageSize: 25 });
    mockGetAllSources.mockResolvedValue(mockSources);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiscoveryView, {
        onGrantSelect: () => {},
        grants: mockGrants,
        sources: mockSources,
      }),
    );
    await vi.waitFor(() => expect(container.textContent).toContain('3 grants'), { timeout: 5000 });

    const searchInput = getByRole(container, 'textbox', {
      name: 'Search grants, funders, and tags',
    }) as HTMLInputElement;
    const nativeInputValueSetter2 = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter2?.call(searchInput, 'nonexistent grant');
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(
      () => expect(container.textContent).toContain('No grants match your current filters'),
      { timeout: 10000 },
    );
    expect(container.textContent).toContain('No grants match your current filters');
    root.unmount();
    container.remove();
  });

  it('opens FunderDetail dialog when funder name is clicked', { timeout: 10000 }, async () => {
    mockGetAllGrants.mockResolvedValue({ items: mockGrants, total: mockGrants.length, page: 1, pageSize: 25 });
    mockGetAllSources.mockResolvedValue(mockSources);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiscoveryView, {
        onGrantSelect: () => {},
        grants: mockGrants,
        sources: mockSources,
      }),
    );
    await vi.waitFor(() => expect(container.textContent).toContain('NSF STEM Education Grant'), {
      timeout: 5000,
    });

    const funderLink = container.querySelector(
      '[aria-label="View funder details for National Science Foundation"]',
    );
    expect(funderLink).not.toBeNull();
    funderLink?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(
      () =>
        expect(
          queryByRole(container, 'dialog', {
            name: /Funder details for National Science Foundation/,
          }),
        ).not.toBeNull(),
      { timeout: 5000 },
    );
    expect(
      queryByRole(container, 'dialog', { name: /Funder details for National Science Foundation/ }),
    ).not.toBeNull();
    root.unmount();
    container.remove();
  });

  it('closes FunderDetail dialog when overlay backdrop is clicked', async () => {
    mockGetAllGrants.mockResolvedValue({ items: mockGrants, total: mockGrants.length, page: 1, pageSize: 25 });
    mockGetAllSources.mockResolvedValue(mockSources);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiscoveryView, {
        onGrantSelect: () => {},
        grants: mockGrants,
        sources: mockSources,
      }),
    );
    await vi.waitFor(() => expect(container.textContent).toContain('NSF STEM Education Grant'), {
      timeout: 5000,
    });

    const funderLink2 = container.querySelector(
      '[aria-label="View funder details for National Science Foundation"]',
    );
    funderLink2?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(
      () =>
        expect(
          queryByRole(container, 'dialog', {
            name: /Funder details for National Science Foundation/,
          }),
        ).not.toBeNull(),
      { timeout: 5000 },
    );

    const closeBtn = container.querySelector('button[aria-label="Close funder detail"]');
    expect(closeBtn).not.toBeNull();
    closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(
      () =>
        expect(
          queryByRole(container, 'dialog', {
            name: /Funder details for National Science Foundation/,
          }),
        ).toBeNull(),
      { timeout: 5000 },
    );
    expect(
      queryByRole(container, 'dialog', { name: /Funder details for National Science Foundation/ }),
    ).toBeNull();
    root.unmount();
    container.remove();
  });
});
