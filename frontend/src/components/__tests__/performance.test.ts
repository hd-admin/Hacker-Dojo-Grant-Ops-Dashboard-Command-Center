// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import React from 'react';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { Grant, Notification, OrganizationProfile, Source } from '../../../../shared/types';
import { DashboardView } from '../DashboardView';
import { PipelineBoard } from '../PipelineBoard';

function makeGrant(index: number): Grant {
  const statuses: Grant['status'][] = ['matched', 'draft', 'review', 'approved', 'submission-ready', 'submitted', 'follow-up', 'awarded', 'declined', 'closed', 'archived'];
  const tags = ['EdTech', 'Community', 'Science & Tech', 'Federal', 'Foundation', 'Corporate'];
  const funders = ['National Science Foundation', 'National Institutes of Health', 'Candid', 'Gates Foundation', 'Google.org', 'Local Community Fund'];
  const funderShorts = ['NSF', 'NIH', 'Candid', 'Gates', 'Google', 'Local'];
  const status = statuses[index % statuses.length]!;
  return {
    id: `grant-${index}`,
    title: `Grant Title ${index} — ${funders[index % 6]!} Opportunity`,
    funder: funders[index % 6]!,
    funderShort: funderShorts[index % 6]!,
    award: `$${(50000 + (index % 20) * 25000).toLocaleString()}`,
    awardSort: 50000 + (index % 20) * 25000,
    deadline: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
    deadlineConfidence: 'exact',
    daysOut: 30 + (index % 90),
    fit: 50 + (index % 50),
    tags: [tags[index % tags.length]!],
    status,
    statusLabel: status.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    matchedAt: new Date(Date.now() - (index % 30) * 86400000).toISOString(),
  };
}

function makeSources(count: number): Source[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `source-${i}`,
    name: `Source ${i}`,
    url: `https://example${i}.com`,
    type: 'website',
    reviewStatus: i % 5 === 0 ? 'pending-review' : 'approved',
    lastCrawledAt: new Date(Date.now() - (i % 10) * 86400000).toISOString(),
    sourceCrawlState: 'succeeded',
  } as Source));
}

function makeNotifications(count: number): Notification[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n-${i}`,
    text: `Notification ${i}: something happened`,
    time: `${i}h ago`,
    dot: 'blue',
  }));
}

const profile: OrganizationProfile = {
  legalName: 'Hacker Dojo',
  ein: '26-3375350',
  samUEI: 'XK7N4HQ2P3M9',
  nonprofitStatus: '501(c)(3)',
  yearFounded: 2009,
  contactInfo: {},
  geography: 'Regional',
  mission: 'Community innovation and education',
  programAreas: ['STEM'],
  populationsServed: ['Youth'],
  fundingHistory: [],
  partnerships: [],
  complianceFacts: [],
  boardMembers: [],
  docTypes: ['PDF'],
  searchThemes: ['EdTech'],
  agentBehavior: {
    autoDraftThreshold: 75,
    submissionPolicy: 'Human approval required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'Plain-spoken',
  },
};

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

describe('[performance] AC-11.1.1-11.1.4', () => {
  it('DashboardView renders 500 grants within 2s', async () => {
    const grants = Array.from({ length: 500 }, (_, i) => makeGrant(i));
    const sources = makeSources(50);
    const notifications = makeNotifications(100);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const start = performance.now();
    root.render(
      React.createElement(DashboardView, {
        grants,
        profile,
        notifications,
        sources,
        onGrantSelect: () => {},
        onNavigate: () => {},
        onRefreshAppState: async () => {},
      }),
    );

    await waitFor(() => container.textContent?.includes('grants in pipeline') ?? false, 3000);
    const elapsed = performance.now() - start;

    root.unmount();
    container.remove();

    expect(elapsed).toBeLessThan(2000);
  });

  it('Discovery filter/sort logic processes 500 grants within 200ms', () => {
    const grants = Array.from({ length: 500 }, (_, i) => makeGrant(i));
    const searchLower = 'grant';
    const category = 'All';

    const start = performance.now();
    const result = [...grants]
      .filter((g) => !searchLower || g.title.toLowerCase().includes(searchLower) || g.funder.toLowerCase().includes(searchLower) || g.tags.some((t) => t.toLowerCase().includes(searchLower)))
      .filter((g) => category === 'All' || g.tags.some((t) => t === category || t.includes(category)))
      .sort((a, b) => b.fit - a.fit);
    const elapsed = performance.now() - start;

    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });

  it('PipelineBoard renders 100 grants within 1s', async () => {
    const grants = Array.from({ length: 100 }, (_, i) => makeGrant(i));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const start = performance.now();
    root.render(
      React.createElement(PipelineBoard, {
        grants,
        onSelectGrant: () => {},
        onStatusChange: async () => {},
      }),
    );

    await waitFor(() => container.querySelector('[data-testid="pipeline-board"]') !== null, 3000);
    const elapsed = performance.now() - start;

    root.unmount();
    container.remove();

    expect(elapsed).toBeLessThan(1000);
  });

  it('Grant export CSV generation processes 500 grants within 500ms', () => {
    const grants = Array.from({ length: 500 }, (_, i) => makeGrant(i));

    const start = performance.now();
    const rows = ['title,funder,award,deadline,deadlineConfidence,daysOut,fit', ...grants.map((grant) => [
      grant.title,
      grant.funder,
      grant.award,
      grant.deadline,
      grant.deadlineConfidence ?? 'unknown',
      String(grant.daysOut),
      String(grant.fit),
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const elapsed = performance.now() - start;

    expect(blob.size).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});
