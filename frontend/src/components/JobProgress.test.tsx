// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { JobProgress } from './JobProgress';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let fetchMock: ReturnType<typeof vi.fn>;

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.unstubAllGlobals();
});

describe('JobProgress', () => {
  it('exports JobProgress component', () => {
    expect(JobProgress).toBeDefined();
    expect(typeof JobProgress).toBe('function');
  });

  describe('AC-14.4.1: polling 500-retry resilience', () => {
    it('shows Connection lost with Retry button after 3 consecutive 500s', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount += 1;
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      });

      root.render(React.createElement(JobProgress, { jobId: 'job-1', jobType: 'research' }));

      await waitFor(() => callCount >= 3, 8000);
      await new Promise((r) => setTimeout(r, 100));

      expect(container.textContent).toContain('Connection lost');
      expect(container.textContent).toContain('Retry now');
    });

    it('clicking Retry resets counter and re-fetches', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount += 1;
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      });

      root.render(React.createElement(JobProgress, { jobId: 'job-1', jobType: 'research' }));

      await waitFor(() => callCount >= 3, 8000);
      await new Promise((r) => setTimeout(r, 100));

      const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Retry now'),
      );
      expect(retryBtn).not.toBeNull();

      const beforeClick = callCount;

      fetchMock.mockImplementation(async () => {
        callCount += 1;
        return new Response(
          JSON.stringify({
            id: 'job-1',
            jobType: 'research',
            status: 'running',
            progress: 50,
            stage: 'analyzing',
            createdAt: new Date().toISOString(),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      });

      retryBtn?.click();
      await new Promise((r) => setTimeout(r, 100));

      expect(callCount).toBeGreaterThan(beforeClick);

      const progressbar = container.querySelector('[role="progressbar"]');
      expect(progressbar).not.toBeNull();
    });

    it('successful fetch after 500s clears error state', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount += 1;
        if (callCount <= 3) {
          return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            id: 'job-1',
            jobType: 'research',
            status: 'running',
            progress: 50,
            stage: 'analyzing',
            createdAt: new Date().toISOString(),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      });

      root.render(React.createElement(JobProgress, { jobId: 'job-1', jobType: 'research' }));

      await waitFor(() => callCount >= 3, 8000);
      await new Promise((r) => setTimeout(r, 100));
      expect(container.textContent).toContain('Connection lost');

      await waitFor(() => callCount >= 4, 8000);
      await new Promise((r) => setTimeout(r, 100));

      expect(container.textContent).not.toContain('Connection lost');
      expect(container.textContent).toContain('analyzing');
    }, 15000);
  });

  describe('AC-14.4.3: background-tab job-polling resume', () => {
    it('calls fetchJob immediately when tab becomes visible', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount += 1;
        return new Response(
          JSON.stringify({
            id: 'job-1',
            jobType: 'research',
            status: 'running',
            progress: 10,
            stage: 'fetching',
            createdAt: new Date().toISOString(),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      });

      root.render(React.createElement(JobProgress, { jobId: 'job-1', jobType: 'research' }));

      await waitFor(() => callCount >= 1, 2000);

      const beforeVisibility = callCount;

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));

      await new Promise((r) => setTimeout(r, 100));
      expect(callCount).toBeGreaterThan(beforeVisibility);
    });

    it('removes visibilitychange listener on unmount', async () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'job-1',
            jobType: 'research',
            status: 'running',
            progress: 10,
            stage: 'fetching',
            createdAt: new Date().toISOString(),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      root.render(React.createElement(JobProgress, { jobId: 'job-1', jobType: 'research' }));

      await new Promise((r) => setTimeout(r, 100));

      expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

      root.unmount();

      expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });
});
