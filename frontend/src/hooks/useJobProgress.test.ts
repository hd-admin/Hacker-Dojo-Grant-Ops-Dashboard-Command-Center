// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { useState } from 'react';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { useJobProgress } from './useJobProgress';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function TestComponent({ jobId }: { jobId: string }) {
  const { job, pollFailures, dismissed, isRetrying, retryNow, dismiss } = useJobProgress(jobId);
  const [lastAction, setLastAction] = useState('');
  return React.createElement('div', null,
    React.createElement('div', { 'data-testid': 'job-status' }, job?.status ?? 'null'),
    React.createElement('div', { 'data-testid': 'poll-failures' }, String(pollFailures)),
    React.createElement('div', { 'data-testid': 'dismissed' }, String(dismissed)),
    React.createElement('div', { 'data-testid': 'is-retrying' }, String(isRetrying)),
    React.createElement('div', { 'data-testid': 'last-action' }, lastAction),
    React.createElement('button', {
      'data-testid': 'btn-retry',
      onClick: () => { setLastAction('retry'); retryNow(); },
    }, 'Retry'),
    React.createElement('button', {
      'data-testid': 'btn-dismiss',
      onClick: () => { setLastAction('dismiss'); dismiss(); },
    }, 'Dismiss'),
  );
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

describe('useJobProgress', () => {
  it('polls job status on mount', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'job-1',
          jobType: 'research',
          status: 'running',
          progress: 50,
          stage: 'analyzing',
          createdAt: new Date().toISOString(),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(TestComponent, { jobId: 'job-1' }));

    await waitFor(() => container.textContent?.includes('running') ?? false);
    expect(container.querySelector('[data-testid="job-status"]')?.textContent).toBe('running');

    root.unmount();
    container.remove();
  });

  it('tracks poll failures', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(TestComponent, { jobId: 'job-1' }));

    await waitFor(() => {
      const el = container.querySelector('[data-testid="poll-failures"]');
      return el !== null && Number(el.textContent) > 0;
    });

    root.unmount();
    container.remove();
  });

  it('dismisses on call', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'job-1',
          jobType: 'research',
          status: 'completed',
          progress: 100,
          stage: 'done',
          createdAt: new Date().toISOString(),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(TestComponent, { jobId: 'job-1' }));

    await waitFor(() => container.textContent?.includes('completed') ?? false);

    const dismissBtn = container.querySelector('[data-testid="btn-dismiss"]') as HTMLButtonElement;
    dismissBtn.click();
    await waitFor(() => container.textContent?.includes('true') ?? false);

    root.unmount();
    container.remove();
  });

  it('retryNow resets failures and fetches', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(TestComponent, { jobId: 'job-1' }));

    await waitFor(() => {
      const el = container.querySelector('[data-testid="poll-failures"]');
      return el !== null && Number(el.textContent) > 0;
    });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'job-1',
          jobType: 'research',
          status: 'running',
          progress: 25,
          stage: 'fetching',
          createdAt: new Date().toISOString(),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const retryBtn = container.querySelector('[data-testid="btn-retry"]') as HTMLButtonElement;
    retryBtn.click();
    await waitFor(() => {
      const el = container.querySelector('[data-testid="poll-failures"]');
      return el !== null && Number(el.textContent) === 0;
    });

    root.unmount();
    container.remove();
  });
});
