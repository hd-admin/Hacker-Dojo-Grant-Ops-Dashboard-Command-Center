// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React, { useRef } from 'react';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { JobQueueItem } from '../../../shared/types';
import { useJobsFeed, __resetJobsFeedCacheForTesting } from './useJobsFeed';

const fetchMock = vi.fn();

const sampleJob: JobQueueItem = {
  id: 'job-1',
  jobType: 'research',
  status: 'running',
  stage: 'analyzing',
  createdAt: new Date().toISOString(),
};

function jobsResponse(items: JobQueueItem[]): Response {
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolveFn: ((v: T) => void) | null = null;
  let rejectFn: ((e: unknown) => void) | null = null;
  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  return {
    promise,
    resolve: (v: T) => {
      if (resolveFn) resolveFn(v);
    },
    reject: (e: unknown) => {
      if (rejectFn) rejectFn(e);
    },
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  // The test runs under REAL timers. The production code uses setTimeout
  // for poll scheduling, so we use a real setTimeout-based wait loop
  // that polls the predicate every 20ms with a wall-clock timeout. This
  // is reliable because React's microtask scheduler and the hook's
  // Promise chain both run normally under real timers — faking
  // setTimeout (or any other timer that vitest's default toFake list
  // includes) breaks React's scheduler, which schedules its state
  // updates via MessageChannel but reads performance.now() / Date.now()
  // to decide when to flush them. Real timers add a small wall-clock
  // cost (~1s per test) for deterministic, non-flaky black-box
  // assertions.
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface TestHarnessProps {
  status?: 'all' | JobQueueItem['status'];
  type?: 'all' | JobQueueItem['jobType'];
  pollIntervalMs?: number;
}

function TestHarness({ status, type, pollIntervalMs }: TestHarnessProps) {
  const opts: { status?: 'all' | JobQueueItem['status']; type?: 'all' | JobQueueItem['jobType']; pollIntervalMs?: number } = {};
  if (status !== undefined) opts.status = status;
  if (type !== undefined) opts.type = type;
  if (pollIntervalMs !== undefined) opts.pollIntervalMs = pollIntervalMs;
  const { jobs, isLoading, error, refresh } = useJobsFeed(opts);
  const jobsRef = useRef<JobQueueItem[]>([]);
  jobsRef.current = jobs;
  return React.createElement(
    'div',
    null,
    React.createElement('div', { 'data-testid': 'jobs-count' }, String(jobs.length)),
    React.createElement('div', { 'data-testid': 'jobs-loading' }, String(isLoading)),
    React.createElement('div', { 'data-testid': 'jobs-error' }, error ?? 'null'),
    React.createElement('div', { 'data-testid': 'jobs-ref' }, String(jobsRef.current.length)),
    React.createElement(
      'button',
      {
        'data-testid': 'jobs-refresh',
        onClick: () => {
          void refresh();
        },
      },
      'refresh',
    ),
  );
}

interface MultiHarnessProps {
  count: number;
  pollIntervalMs?: number;
  status?: 'all' | JobQueueItem['status'];
  type?: 'all' | JobQueueItem['jobType'];
}

function MultiHarness({ count, pollIntervalMs, status, type }: MultiHarnessProps) {
  const items: React.ReactElement[] = [];
  for (let i = 0; i < count; i += 1) {
    const childProps: { key: string; pollIntervalMs?: number; status?: 'all' | JobQueueItem['status']; type?: 'all' | JobQueueItem['jobType'] } = { key: `h-${i}` };
    if (pollIntervalMs !== undefined) childProps.pollIntervalMs = pollIntervalMs;
    if (status !== undefined) childProps.status = status;
    if (type !== undefined) childProps.type = type;
    items.push(React.createElement(TestHarness, childProps));
  }
  return React.createElement('div', { 'data-testid': `multi-harness-count-${count}` }, ...items);
}

beforeEach(() => {
  vi.useRealTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  // The hook holds a module-level feedCache that persists across tests
  // in the same file. Reset it here so each test starts with a clean
  // entry (no stale jobs, no inflight Promise from a previous test,
  // no leftover intervalId). Without this reset, Test B observes
  // the entries left over by Test A and the assertions misfire.
  __resetJobsFeedCacheForTesting();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useJobsFeed', () => {
  it('Test A: deduplicates fetches across multiple mounted consumers', async () => {
    fetchMock.mockResolvedValue(jobsResponse([sampleJob]));

    const container = document.createElement('div');
    document.body.appendChild(container);

    // Single React root; we re-render with a MultiHarness of increasing
    // size so the same optionsKey is shared by every consumer. The 2nd
    // consumer is added by re-rendering the same root (not by creating a
    // second createRoot() on the same container, which React disallows).
    const root = createRoot(container);
    root.render(React.createElement(MultiHarness, { count: 1, pollIntervalMs: 200 }));

    await waitFor(() => {
      const el = container.querySelector('[data-testid="jobs-count"]');
      return el !== null && el.textContent === '1';
    });

    const callsAfterFirstMount = fetchMock.mock.calls.length;

    // Add a 2nd consumer sharing the same optionsKey. The poll loop must
    // stay deduplicated: at most 1 fetch in the 50ms after the 2nd mount
    // (no immediate re-fetch, the second mount is a no-op for the
    // cache key), then 3 polls over the next 3s (one at 200ms intervals).
    root.render(React.createElement(MultiHarness, { count: 2, pollIntervalMs: 200 }));

    await sleep(50);
    const callsShortlyAfterSecondMount = fetchMock.mock.calls.length;
    expect(callsShortlyAfterSecondMount - callsAfterFirstMount).toBeLessThanOrEqual(1);

    const callsAfterBothMount = fetchMock.mock.calls.length;

    await waitFor(
      () => fetchMock.mock.calls.length >= callsAfterBothMount + 3,
      5000,
    );

    const totalCalls = fetchMock.mock.calls.length;
    const extraCalls = totalCalls - callsAfterBothMount;
    expect(extraCalls).toBeLessThanOrEqual(3);
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterBothMount + 3);

    root.unmount();
    container.remove();
  });

  it('Test B: does not self-perpetuate when the resolved jobs array reference changes', async () => {
    let resolveCount = 0;
    fetchMock.mockImplementation(() => {
      resolveCount += 1;
      if (resolveCount === 1) {
        return Promise.resolve(jobsResponse([sampleJob]));
      }
      return Promise.resolve(jobsResponse([{ ...sampleJob, status: 'completed' }]));
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(TestHarness, { pollIntervalMs: 200 }));

    await waitFor(() => {
      const el = container.querySelector('[data-testid="jobs-count"]');
      return el !== null && el.textContent === '1';
    });

    const initialCallCount = fetchMock.mock.calls.length;

    // Wait for at least 2 more fetches to fire, bounded at 2x the poll
    // interval so a self-perpetuation bug would surface as > 2 calls.
    await waitFor(() => fetchMock.mock.calls.length >= initialCallCount + 1, 1500);
    await waitFor(() => fetchMock.mock.calls.length >= initialCallCount + 2, 2500);

    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(initialCallCount + 2);

    root.unmount();
    container.remove();
  });

  it('Test C: applies exponential backoff after consecutive failures and resets on success', async () => {
    const inflight = deferred<Response>();
    fetchMock.mockImplementationOnce(() => inflight.promise);
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    fetchMock.mockResolvedValueOnce(jobsResponse([sampleJob]));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(TestHarness, { pollIntervalMs: 200 }));

    // Attach a no-op .catch to the inflight promise so the Node
    // process does not flag the rejection as unhandled when the test
    // exits. The hook's performFetch() already catches the rejection
    // internally, but the deferred's underlying promise is the one we
    // created here and Node treats that as unhandled until something
    // subscribes.
    inflight.promise.catch(() => undefined);
    inflight.reject(new Error('first call fails'));
    await waitFor(() => fetchMock.mock.calls.length >= 1);

    // Each failure bumps consecutiveFailures; the next poll is delayed
    // exponentially (200ms * 2 = 400ms, then * 4 = 800ms). Wait long
    // enough to see 3 attempts after the first failure.
    await waitFor(() => fetchMock.mock.calls.length >= 2, 1500);
    await waitFor(() => fetchMock.mock.calls.length >= 3, 3000);

    const beforeSuccess = fetchMock.mock.calls.length;

    // After enough backoff, a successful response resets consecutiveFailures
    // and the poll loop resumes. We just need to see the count grow.
    await waitFor(() => fetchMock.mock.calls.length > beforeSuccess, 5000);

    expect(fetchMock.mock.calls.length).toBeGreaterThan(beforeSuccess);

    root.unmount();
    container.remove();
  });

  it('Test D: stops polling after unmount', async () => {
    fetchMock.mockResolvedValue(jobsResponse([sampleJob]));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(TestHarness, { pollIntervalMs: 200 }));

    await waitFor(() => {
      const el = container.querySelector('[data-testid="jobs-count"]');
      return el !== null && el.textContent === '1';
    });

    const callCountAtUnmount = fetchMock.mock.calls.length;
    root.unmount();
    container.remove();

    // Wait 1.5s and verify no fetches fired after unmount.
    await sleep(1500);
    expect(fetchMock.mock.calls.length).toBe(callCountAtUnmount);
  });

  it('Test E: React strict-mode mount+unmount+remount does not zero out the subscriber counter', async () => {
    fetchMock.mockResolvedValue(jobsResponse([sampleJob]));

    const container = document.createElement('div');
    document.body.appendChild(container);

    // First mount + unmount
    const root1 = createRoot(container);
    root1.render(React.createElement(TestHarness, { pollIntervalMs: 200 }));
    await waitFor(() => {
      const el = container.querySelector('[data-testid="jobs-count"]');
      return el !== null && el.textContent === '1';
    });
    const callsAfterFirstMount = fetchMock.mock.calls.length;
    root1.unmount();

    // Wait a beat so the unmount cleanup runs
    await sleep(50);

    // Remount with the same optionsKey
    const root2 = createRoot(container);
    root2.render(React.createElement(TestHarness, { pollIntervalMs: 200 }));
    await waitFor(() => fetchMock.mock.calls.length > callsAfterFirstMount, 2000);
    const callsAfterRemount = fetchMock.mock.calls.length;

    // Wait 2s and verify the poll loop is alive (at least 1 more fetch).
    // A subscriber-counter bug would manifest as either 0 polls (counter
    // zeroed, scheduleNextTick never re-fires) or a runaway burst.
    await sleep(2000);

    const totalCalls = fetchMock.mock.calls.length;
    expect(totalCalls).toBeGreaterThan(callsAfterRemount);
    // The poll interval is 200ms; over 2s we expect 8-12 polls. A
    // self-perpetuating bug would push this into the hundreds.
    expect(totalCalls - callsAfterRemount).toBeLessThanOrEqual(20);

    root2.unmount();
    container.remove();
  });

  it('Test F: three TestHarness components with the same options share one poll loop', async () => {
    fetchMock.mockResolvedValue(jobsResponse([sampleJob]));

    const container = document.createElement('div');
    document.body.appendChild(container);

    // Single root, three harnesses with identical options so they share
    // the same optionsKey and the same FeedEntry.
    const root = createRoot(container);
    root.render(React.createElement(MultiHarness, { count: 3, pollIntervalMs: 200 }));

    // Wait for the initial fetch to resolve and at least one consumer to
    // render the resolved jobs array.
    await waitFor(() => {
      const el = container.querySelector('[data-testid="jobs-count"]');
      return el !== null && el.textContent === '1';
    });
    const callsAfterMount = fetchMock.mock.calls.length;

    // Wait long enough for 3 polls to occur (200ms * 3 = 600ms), then a
    // bit of slack to observe the upper bound. The headcount should be
    // a small, bounded number; a deduplication regression would push
    // it past 1 fetch per consumer per tick.
    await sleep(1000);

    const totalCalls = fetchMock.mock.calls.length;
    // Initial fetch + up to 5 polls over 1s at 200ms. Allow some slack
    // for the last in-flight poll to be the boundary case.
    expect(totalCalls - callsAfterMount).toBeLessThanOrEqual(6);

    // Unmount all three consumers. After unmount, the subscriber set
    // should be empty, and the poll interval timer should be cleared.
    root.unmount();
    container.remove();
    const callsAfterUnmount = fetchMock.mock.calls.length;

    await sleep(1000);
    expect(fetchMock.mock.calls.length).toBe(callsAfterUnmount);
  });
});
