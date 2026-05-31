// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { JobQueueItem } from '../../../shared/types';

const mockJobs: JobQueueItem[] = [
  {
    id: 'job-1',
    jobType: 'research',
    status: 'running',
    stage: 'analyzing',
    lastUpdate: '2026-05-28T10:30:00.000Z',
    createdAt: '2026-05-28T10:00:00.000Z',
    startedAt: '2026-05-28T10:15:00.000Z',
    entityId: 'grant-1',
    retryCount: 0,
  },
  {
    id: 'job-2',
    jobType: 'draft',
    status: 'completed',
    stage: 'completed',
    lastUpdate: '2026-05-28T09:45:00.000Z',
    createdAt: '2026-05-28T09:30:00.000Z',
    startedAt: '2026-05-28T09:31:00.000Z',
    completedAt: '2026-05-28T09:45:00.000Z',
    entityId: 'grant-2',
    retryCount: 0,
    resultSummary: 'Draft generated successfully',
  },
  {
    id: 'job-3',
    jobType: 'research',
    status: 'failed',
    stage: 'failed',
    lastUpdate: '2026-05-28T08:00:00.000Z',
    createdAt: '2026-05-28T07:30:00.000Z',
    startedAt: '2026-05-28T07:31:00.000Z',
    completedAt: '2026-05-28T08:00:00.000Z',
    entityId: 'grant-3',
    retryCount: 1,
    errorMessage: 'Rate limit exceeded',
    failureCategory: 'rate-limit',
  },
  {
    id: 'job-4',
    jobType: 'draft',
    status: 'queued',
    stage: 'queued',
    lastUpdate: '2026-05-28T11:00:00.000Z',
    createdAt: '2026-05-28T11:00:00.000Z',
    retryCount: 0,
  },
  {
    id: 'job-5',
    jobType: 'research',
    status: 'cancelled',
    stage: 'cancelled',
    lastUpdate: '2026-05-28T08:30:00.000Z',
    createdAt: '2026-05-28T08:00:00.000Z',
    startedAt: '2026-05-28T08:01:00.000Z',
    completedAt: '2026-05-28T08:30:00.000Z',
    retryCount: 0,
  },
];

import { JobsPanel } from './JobsPanel';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

describe('JobsPanel', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockJobs,
    } as Response);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders the panel with header', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const header = container.querySelector('[data-testid="jobs-panel-header"]');
    expect(header).not.toBeNull();
    expect(header?.querySelector('.header-title')?.textContent).toContain('Job');
  });

  it('renders status filter tabs', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const statusFilter = container.querySelector('[data-testid="jobs-status-filter"]');
    expect(statusFilter).not.toBeNull();
    const buttons = statusFilter?.querySelectorAll('button');
    expect(buttons?.length).toBe(6); // All, Queued, Running, Completed, Failed, Cancelled
  });

  it('renders type filter tabs', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const typeFilter = container.querySelector('[data-testid="jobs-type-filter"]');
    expect(typeFilter).not.toBeNull();
    const buttons = typeFilter?.querySelectorAll('button');
    expect(buttons?.length).toBe(10); // All + 9 job types
  });

  it('renders job items with progress bars', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const jobItems = container.querySelectorAll('[data-testid^="job-item-"]');
    expect(jobItems.length).toBeGreaterThanOrEqual(1);
    const progressBars = container.querySelectorAll('[data-testid^="job-progress-"]');
    expect(progressBars.length).toBeGreaterThanOrEqual(1);
  });

  it('shows failure guidance for failed jobs', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const failedItem = container.querySelector('[data-testid="job-item-failed-job-3"]');
    expect(failedItem).not.toBeNull();
    // Expand the job card to see failure guidance
    const toggleBtn = container.querySelector('[data-testid="job-toggle-details-job-3"]') as HTMLButtonElement;
    toggleBtn?.click();
    await new Promise((r) => setTimeout(r, 50));
    // Expanded failure guidance should include the category and description
    const guidanceEl = container.querySelector('[data-testid="job-failure-guidance-job-3"]');
    expect(guidanceEl).not.toBeNull();
    expect(guidanceEl?.textContent).toMatch(/Rate limited|rate.limit/i);
  });

  it('filters by status', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    // Click "Failed" filter
    const failedBtn = container.querySelector('[data-testid="jobs-status-filter"] button[data-status="failed"]') as HTMLButtonElement;
    expect(failedBtn).not.toBeNull();
    failedBtn?.click();
    await new Promise((r) => setTimeout(r, 50));

    // Should only show failed jobs
    const visibleItems = container.querySelectorAll('[data-testid^="job-item-"]:not([style*="display: none"])');
    expect(visibleItems.length).toBeGreaterThanOrEqual(1);
    visibleItems.forEach((item) => {
      expect(item.getAttribute('data-testid')).toContain('failed');
    });
  });

  it('filters by type', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    // Click "Draft" type filter
    const draftBtn = container.querySelector('[data-testid="jobs-type-filter"] button[data-type="draft"]') as HTMLButtonElement;
    expect(draftBtn).not.toBeNull();
    draftBtn?.click();
    await new Promise((r) => setTimeout(r, 50));

    // Should only show draft jobs
    const visibleItems = container.querySelectorAll('[data-testid^="job-item-"]:not([style*="display: none"])');
    expect(visibleItems.length).toBeGreaterThanOrEqual(1);
    visibleItems.forEach((item) => {
      expect(item.textContent).toMatch(/draft/i);
    });
  });

  it('shows entity links when entityId exists', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const entityLink = container.querySelector('[data-testid="job-entity-link-job-1"]');
    expect(entityLink).not.toBeNull();
    expect(entityLink?.textContent).toContain('grant-1');
  });

  it('shows timestamps for each job', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const jobItems = container.querySelectorAll('[data-testid^="job-item-"]');
    jobItems.forEach((item) => {
      const timestamps = item.querySelector('[data-testid^="job-timestamps-"]');
      expect(timestamps).not.toBeNull();
    });
  });
});
