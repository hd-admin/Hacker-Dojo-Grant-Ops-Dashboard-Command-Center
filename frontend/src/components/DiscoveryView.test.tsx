// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { Grant, Source } from '../../../shared/types';

const {
  mockGetAllGrants,
  mockGetAllSources,
  mockGetRuns,
} = vi.hoisted(() => ({
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

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

describe('DiscoveryView', () => {
  beforeEach(() => {
    mockGetAllGrants.mockResolvedValue([]);
    mockGetAllSources.mockResolvedValue([]);
    mockGetRuns.mockResolvedValue({ latestRun: null, allRuns: [] });
    window.localStorage.clear();
  });

  it('renders empty state when no grants provided', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiscoveryView, {
        onGrantSelect: () => {},
      })
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('[data-testid="discovery-empty-state"]')).not.toBeNull();
    root.unmount();
    container.remove();
  });

  it('renders grant list when grants are provided', async () => {
    mockGetAllGrants.mockResolvedValue(mockGrants);
    mockGetAllSources.mockResolvedValue(mockSources);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiscoveryView, {
        onGrantSelect: () => {},
        grants: mockGrants,
        sources: mockSources,
      })
    );
    await waitFor(() => container.textContent?.includes('NSF STEM Education Grant') === true);
    expect(container.textContent).toContain('NSF STEM Education Grant');
    expect(container.textContent).toContain('Community Innovation Fund');
    expect(container.textContent).toContain('EdTech Accelerator');
    expect(container.textContent).toContain('NSF');
    expect(container.textContent).toContain('Candid');
    root.unmount();
    container.remove();
  });

  it('filters grants by search query', { timeout: 10000 }, async () => {
    mockGetAllGrants.mockResolvedValue(mockGrants);
    mockGetAllSources.mockResolvedValue(mockSources);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiscoveryView, {
        onGrantSelect: () => {},
        grants: mockGrants,
        sources: mockSources,
      })
    );
    await waitFor(() => container.textContent?.includes('3 grants') === true);

    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(searchInput, 'NSF');
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => container.textContent?.includes('1 grants') === true, 5000);
    expect(container.textContent).toContain('NSF STEM Education Grant');
    expect(container.textContent).not.toContain('Community Innovation Fund');
    expect(container.textContent).not.toContain('EdTech Accelerator');
    root.unmount();
    container.remove();
  });



  it('shows filter empty state when no grants match', { timeout: 10000 }, async () => {
    mockGetAllGrants.mockResolvedValue(mockGrants);
    mockGetAllSources.mockResolvedValue(mockSources);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(DiscoveryView, {
        onGrantSelect: () => {},
        grants: mockGrants,
        sources: mockSources,
      })
    );
    await waitFor(() => container.textContent?.includes('3 grants') === true);

    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(searchInput, 'nonexistent grant');
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => container.querySelector('[data-testid="discovery-filter-empty-state"]') !== null, 5000);
    expect(container.querySelector('[data-testid="discovery-filter-empty-state"]')).not.toBeNull();
    root.unmount();
    container.remove();
  });
});
