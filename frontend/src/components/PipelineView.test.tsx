// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { getByText, queryByText } from '../test-helpers';
import type { Grant } from '../../../shared/types';
import { PipelineView } from './PipelineView';

const { mockGetAllGrants, mockGetSettings } = vi.hoisted(() => ({
  mockGetAllGrants: vi.fn(),
  mockGetSettings: vi.fn(),
}));

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    grants: { getAll: mockGetAllGrants },
    settings: { get: mockGetSettings },
  },
}));

const baseGrant: Grant = {
  id: 'p-1',
  title: 'Pipeline Test Grant',
  funder: 'Pipeline Foundation',
  funderShort: 'PTF',
  award: '$50,000',
  awardSort: 50000,
  deadline: '2026-09-30',
  daysOut: 100,
  fit: 80,
  tags: ['Foundation'],
  status: 'matched',
  statusLabel: 'Matched',
  matchedAt: '2026-05-01',
  deadlineConfidence: 'exact',
};

describe('PipelineView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllGrants.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    mockGetSettings.mockResolvedValue({});
    if (typeof window.localStorage?.clear === 'function') {
      window.localStorage.clear();
    }
  });

  it('renders empty state', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(PipelineView, {
        onGrantSelect: () => {},
      }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(getByText(container, 'Your pipeline is empty')).not.toBeNull();
    root.unmount();
    container.remove();
  });

  it('renders last-seen-badge and last-updated-badge for a card with both timestamps set', async () => {
    const grants: Grant[] = [
      {
        ...baseGrant,
        lastSeenAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        lastUpdatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    // The internal load() overwrites the initial state, so mirror it through the mock.
    mockGetAllGrants.mockResolvedValue({ items: grants, total: grants.length, page: 1, pageSize: 25 });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(PipelineView, {
        onGrantSelect: () => {},
        grants,
      }),
    );
    // Wait for the load + render cycles to settle.
    await new Promise((r) => setTimeout(r, 250));
    const lastSeen = container.querySelectorAll('[data-testid="last-seen-badge"]');
    const lastUpdated = container.querySelectorAll('[data-testid="last-updated-badge"]');
    expect(lastSeen.length).toBeGreaterThan(0);
    expect(lastUpdated.length).toBeGreaterThan(0);
    expect(lastSeen.length).toBe(lastUpdated.length);
    expect(lastSeen[0]?.textContent).toMatch(/Last seen/);
    expect(lastUpdated[0]?.textContent).toMatch(/Updated/);
    root.unmount();
    container.remove();
  });

  it('renders em-dash for missing lastSeenAt in the badge slot', async () => {
    const grants: Grant[] = [{ ...baseGrant }]; // no lastSeenAt / lastUpdatedAt
    mockGetAllGrants.mockResolvedValue({ items: grants, total: grants.length, page: 1, pageSize: 25 });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(PipelineView, {
        onGrantSelect: () => {},
        grants,
      }),
    );
    await new Promise((r) => setTimeout(r, 250));
    const lastSeen = Array.from(
      container.querySelectorAll('[data-testid="last-seen-badge"]'),
    ) as HTMLElement[];
    expect(lastSeen.length).toBeGreaterThan(0);
    for (const el of lastSeen) {
      expect(el.textContent).toContain('\u2014');
    }
    root.unmount();
    container.remove();
  });

  it('surfaces a View archived link to /discovery?showArchived=1', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(PipelineView, {
        onGrantSelect: () => {},
      }),
    );
    await new Promise((r) => setTimeout(r, 100));
    const link = container.querySelector('[data-testid="view-archived-link"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/discovery?showArchived=1');
    expect(queryByText(container, 'View archived')).not.toBeNull();
    root.unmount();
    container.remove();
  });
});

