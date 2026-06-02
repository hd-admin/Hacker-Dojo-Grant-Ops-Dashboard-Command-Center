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

import { getByLabelText, getByRole, getAllByRole } from '../test-helpers';
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

    const header = getByLabelText(container, 'Job Queue');
    expect(header).not.toBeNull();
    expect(header?.textContent).toContain('Job');
  });

  it('renders status filter tabs', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const statusFilter = getByRole(container, 'tablist', { name: 'Filter by job status' });
    expect(statusFilter).not.toBeNull();
    const tabs = getAllByRole(statusFilter, 'tab');
    expect(tabs.length).toBe(6); // All, Queued, Running, Completed, Failed, Cancelled
  });

  it('renders type filter tabs', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const typeFilter = getByRole(container, 'tablist', { name: 'Filter by job type' });
    expect(typeFilter).not.toBeNull();
    const tabs = getAllByRole(typeFilter, 'tab');
    expect(tabs.length).toBe(10); // All + 9 job types
  });

  it('renders job items with progress bars', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    const progressBars = getAllByRole(container, 'progressbar');
    expect(progressBars.length).toBeGreaterThanOrEqual(1);
  });

  it('shows failure guidance for failed jobs', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    // Expand the failed job card to see failure guidance
    const toggleBtn = getByRole(container, 'button', {
      name: /Toggle details for research job job-3/,
    });
    toggleBtn?.click();
    await new Promise((r) => setTimeout(r, 100));
    // Failure guidance should include the category and description
    expect(container.textContent).toMatch(/Rate limited|rate.limit/i);
  });

  it('filters by status', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    // Click "Failed" filter
    const statusFilter = getByRole(container, 'tablist', { name: 'Filter by job status' });
    const tabs = getAllByRole(statusFilter, 'tab');
    const failedBtn = tabs.find((b) =>
      b.textContent?.toLowerCase().includes('failed'),
    ) as HTMLButtonElement | null;
    expect(failedBtn).not.toBeNull();
    failedBtn?.click();
    await new Promise((r) => setTimeout(r, 50));

    // Should only show failed jobs
    expect(container.textContent).toMatch(/Retry #1/);
    expect(container.textContent).not.toMatch(/Draft generated successfully/);
  });

  it('filters by type', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    // Click "Draft" type filter
    const typeFilter = getByRole(container, 'tablist', { name: 'Filter by job type' });
    const tabs = getAllByRole(typeFilter, 'tab');
    const draftBtn = tabs.find((b) =>
      b.textContent?.toLowerCase().includes('draft'),
    ) as HTMLButtonElement | null;
    expect(draftBtn).not.toBeNull();
    draftBtn?.click();
    await new Promise((r) => setTimeout(r, 50));

    // Should only show draft jobs
    expect(container.textContent).toMatch(/Waiting to start/);
    expect(container.textContent).not.toMatch(/Retry #1/);
  });

  it('shows entity links when entityId exists', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    expect(container.textContent).toContain('grant-1');
  });

  it('shows timestamps for each job', async () => {
    root.render(React.createElement(JobsPanel, { onRefreshAppState: vi.fn() }));
    await new Promise((r) => setTimeout(r, 100));

    expect(container.textContent).toMatch(/Created:/);
    expect(container.textContent).toMatch(/Updated:/);
  });
});
