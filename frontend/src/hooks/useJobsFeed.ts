'use client';

// Client-only shared /api/jobs feed. All three consumers (AppShell, DashboardView,
// JobsPanel) route through this hook so duplicate pollers cannot re-create the
// 60+ hits/sec storm that the prior self-perpetuating effects caused.
//
// IMPORTANT: This hook is client-only. It uses useRef, useEffect, useState,
// setInterval, and fetch. Do NOT import it from a Server Component. The
// 'use client' directive at the top of this file is the Next.js App Router
// contract that prevents accidental server-side imports.

import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { JobQueueItemSchema } from '../../../shared/schemas';
import type { JobQueueItem } from '../../../shared/types';

export type JobStatus = JobQueueItem['status'];
export type JobTypeFilter = JobQueueItem['jobType'];

export interface UseJobsFeedOptions {
  pollIntervalMs?: number;
  status?: JobStatus | 'all';
  type?: JobTypeFilter | 'all';
}

export interface UseJobsFeedResult {
  jobs: JobQueueItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface FeedEntry {
  optionsKey: string;
  jobs: JobQueueItem[];
  lastFetched: number;
  lastError: string | null;
  consecutiveFailures: number;
  inflight: Promise<void> | null;
  intervalId: ReturnType<typeof setTimeout> | null;
  subscribers: Set<(snapshot: JobQueueItem[]) => void>;
}

const ACTIVE_BASE_INTERVAL_MS = 5000;
const IDLE_BASE_INTERVAL_MS = 15000;
const MIN_POLL_INTERVAL_MS = 250;
const MAX_BACKOFF_EXPONENT = 5;

const feedCache: Map<string, FeedEntry> = new Map();

/**
 * Test-only escape hatch. Resets the module-level feed cache so each
 * test starts from a clean slate. Production code never calls this; it
 * exists so the useJobsFeed.test.ts black-box tests do not observe
 * stale entries (and stale inflight Promises) left over from the
 * previous test case. Exported as a named binding rather than mutated
 * by a side-effecting import to keep the public API surface small.
 */
export function __resetJobsFeedCacheForTesting(): void {
  for (const entry of feedCache.values()) {
    if (entry.intervalId !== null) {
      clearTimeout(entry.intervalId);
    }
  }
  feedCache.clear();
}

function safeLogError(err: unknown): void {
  try {
    // This hook is client-only ('use client'), so it runs in the browser.
    // The server-side pino/pino-roll logger pulls in Node 'fs/promises' and
    // cannot be bundled for the browser, so client errors go to console.
    // Wrapped in try/catch so logging can never take down the poll loop.
    console.error(err);
  } catch {
    // Swallow: never let logging take down the poll loop.
  }
}

function buildOptionsKey(options: UseJobsFeedOptions | undefined): string {
  if (!options) return 'default';
  const status = options.status ?? 'all';
  const type = options.type ?? 'all';
  return `poll=${options.pollIntervalMs ?? 'default'}|status=${status}|type=${type}`;
}

function buildUrl(options: UseJobsFeedOptions | undefined): string {
  const params = new URLSearchParams();
  if (options?.status && options.status !== 'all') {
    params.set('status', options.status);
  }
  if (options?.type && options.type !== 'all') {
    params.set('type', options.type);
  }
  const query = params.toString();
  return `/api/jobs${query ? `?${query}` : ''}`;
}

function getOrCreateEntry(optionsKey: string): FeedEntry {
  const existing = feedCache.get(optionsKey);
  if (existing) return existing;
  const created: FeedEntry = {
    optionsKey,
    jobs: [],
    lastFetched: 0,
    lastError: null,
    consecutiveFailures: 0,
    inflight: null,
    intervalId: null,
    subscribers: new Set(),
  };
  feedCache.set(optionsKey, created);
  return created;
}

function notifySubscribers(entry: FeedEntry): void {
  for (const sub of entry.subscribers) {
    try {
      sub(entry.jobs);
    } catch (err) {
      safeLogError(err);
    }
  }
}

async function performFetch(entry: FeedEntry, url: string): Promise<void> {
  if (entry.inflight) return entry.inflight;
  const work = (async (): Promise<void> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        entry.consecutiveFailures += 1;
        entry.lastError = `Request failed: ${response.status}`;
        notifySubscribers(entry);
        return;
      }
      const raw: unknown = await response.json();
      const parsed = z.array(JobQueueItemSchema).safeParse(raw);
      if (!parsed.success) {
        entry.consecutiveFailures += 1;
        entry.lastError = 'Validation error: malformed jobs response';
        safeLogError(parsed.error);
        notifySubscribers(entry);
        return;
      }
      entry.jobs = parsed.data;
      entry.lastFetched = Date.now();
      entry.lastError = null;
      entry.consecutiveFailures = 0;
      notifySubscribers(entry);
    } catch (err) {
      entry.consecutiveFailures += 1;
      entry.lastError = err instanceof Error ? err.message : 'Network error';
      safeLogError(err);
      notifySubscribers(entry);
    } finally {
      entry.inflight = null;
    }
  })();
  entry.inflight = work;
  return work;
}

function scheduleNextTick(entry: FeedEntry, options: UseJobsFeedOptions | undefined): void {
  if (entry.intervalId !== null) {
    clearTimeout(entry.intervalId);
    entry.intervalId = null;
  }
  if (entry.subscribers.size === 0) return;

  const hasActive = entry.jobs.some(
    (job) =>
      job.status === 'queued' ||
      job.status === 'running' ||
      job.status === 'verifying' ||
      job.status === 'retrying',
  );
  const base = options?.pollIntervalMs ?? (hasActive ? ACTIVE_BASE_INTERVAL_MS : IDLE_BASE_INTERVAL_MS);
  const backoffMultiplier = Math.pow(2, Math.min(entry.consecutiveFailures, MAX_BACKOFF_EXPONENT));
  const delay = Math.max(MIN_POLL_INTERVAL_MS, base * backoffMultiplier);

  entry.intervalId = setTimeout(() => {
    const url = buildUrl(options);
    void performFetch(entry, url).then(() => {
      if (entry.subscribers.size > 0) {
        scheduleNextTick(entry, options);
      }
    });
  }, delay);
}

export function useJobsFeed(options?: UseJobsFeedOptions): UseJobsFeedResult {
  const optionsKey = buildOptionsKey(options);
  const entry = getOrCreateEntry(optionsKey);

  const [jobs, setJobs] = useState<JobQueueItem[]>(() => entry.jobs);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(entry.lastError);

  const optionsRef = useRef<UseJobsFeedOptions | undefined>(options);
  optionsRef.current = options;

  const subscriber = useCallback((snapshot: JobQueueItem[]): void => {
    setJobs(snapshot);
    setIsLoading(false);
    setError(entry.lastError);
  }, [entry]);

  useEffect(() => {
    entry.subscribers.add(subscriber);
    setJobs(entry.jobs);
    setIsLoading(entry.lastFetched === 0);
    setError(entry.lastError);

    if (entry.lastFetched === 0 && entry.inflight === null) {
      const url = buildUrl(optionsRef.current);
      void performFetch(entry, url).then(() => {
        if (entry.subscribers.size > 0) {
          scheduleNextTick(entry, optionsRef.current);
        }
      });
    } else if (entry.subscribers.size === 1) {
      scheduleNextTick(entry, optionsRef.current);
    }

    return () => {
      const nextSize = Math.max(0, entry.subscribers.size - 1);
      entry.subscribers.delete(subscriber);
      if (nextSize === 0 && entry.intervalId !== null) {
        clearTimeout(entry.intervalId);
        entry.intervalId = null;
      }
    };
    // entry is a module-cached singleton keyed by optionsKey; identity is
    // stable for the lifetime of the optionsKey, so this effect only re-runs
    // when the optionsKey changes.
  }, [optionsKey, subscriber, entry]);

  const refresh = useCallback(async (): Promise<void> => {
    const url = buildUrl(optionsRef.current);
    await performFetch(entry, url);
    setJobs(entry.jobs);
    setIsLoading(false);
    setError(entry.lastError);
    if (entry.subscribers.size > 0) {
      scheduleNextTick(entry, optionsRef.current);
    }
  }, [entry]);

  return { jobs, isLoading, error, refresh };
}
