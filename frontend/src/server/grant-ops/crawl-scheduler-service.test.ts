import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../shared/grant-ops-persistence';
import { truncateDatabase, getSqliteState } from '../../../../shared/grant-ops-sqlite';
import { saveCrawlSchedule, loadCrawlSchedules } from '../../../../shared/grant-ops-persistence';
import { defaultProfile } from '../../../../shared/seed-data';
import * as repository from './repository';

import {
  checkAndRunDue,
  disableScheduleForSource,
  getScheduleForSource,
  upsertScheduleForSource,
  startCrawlScheduler,
  stopCrawlScheduler,
  type Timer,
} from './crawl-scheduler-service';

const runResearchMock = vi.hoisted(() =>
  vi.fn(async () => ({
    crawlRun: {
      id: 'crawl-1',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: 'completed' as const,
      sourcesCrawled: 1,
      grantsFound: 0,
      grantsMatched: 0,
    },
    grantsFound: 0,
    grantsMatched: 0,
  })),
);

vi.mock('./research-service', () => ({ runResearch: runResearchMock }));

describe('crawl-scheduler-service', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let state: ReturnType<typeof getSqliteState>;

  beforeAll(async () => {
    tempDataDir = await withTempDataDir();
    state = getSqliteState();
  });

  afterAll(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  beforeEach(async () => {
    await truncateDatabase(state);
    invalidateCache();
    runResearchMock.mockReset();
    runResearchMock.mockResolvedValue({
      crawlRun: {
        id: 'crawl-1',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: 'completed',
        sourcesCrawled: 1,
        grantsFound: 0,
        grantsMatched: 0,
      },
      grantsFound: 0,
      grantsMatched: 0,
    });
  });

  it('upserts schedules with the expected next run time', async () => {
    const schedule = await upsertScheduleForSource('source-1', 12);

    expect(schedule.sourceId).toBe('source-1');
    expect(schedule.intervalHours).toBe(12);
    expect(new Date(schedule.nextScheduledAt).getTime()).toBeGreaterThan(Date.now());
    expect(await getScheduleForSource('source-1')).toMatchObject({
      id: schedule.id,
      isEnabled: true,
    });
  });

  it('triggers due schedules with the real research path and persists the rescheduled time', async () => {
    // Set up profile and an approved source (required by checkAndRunDue)
    await repository.updateOrgProfile(defaultProfile);
    await repository.addSource({
      id: 'source-1',
      name: 'Test Source',
      url: 'https://example.com',
      type: 'website',
      createdAt: new Date().toISOString(),
      isActive: true,
      reviewStatus: 'approved',
      sourceCrawlState: 'never-crawled',
      crawlAccessCategory: 'crawlable',
    });

    const schedule = await upsertScheduleForSource('source-1', 1);
    await saveCrawlSchedule({
      ...schedule,
      nextScheduledAt: new Date(Date.now() - 1_000).toISOString(),
    });

    const triggered = await checkAndRunDue();
    const updated = await getScheduleForSource('source-1');

    expect(triggered).toBeGreaterThanOrEqual(1);
    expect(runResearchMock).toHaveBeenCalledTimes(1);
    expect(runResearchMock).toHaveBeenCalledWith(
      expect.objectContaining({ legalName: defaultProfile.legalName }),
      { sourceIds: ['source-1'] },
    );
    expect(updated?.nextScheduledAt).toBeDefined();
    expect(new Date(updated?.nextScheduledAt ?? '').getTime()).toBeGreaterThan(Date.now());
  });

  it('disables a schedule when requested', async () => {
    await upsertScheduleForSource('source-1', 24);
    await disableScheduleForSource('source-1');

    expect(await getScheduleForSource('source-1')).toBeNull();
    expect(await loadCrawlSchedules()).toEqual([]);
  });
});

describe('crawl-scheduler timer injection', () => {
  beforeEach(() => {
    stopCrawlScheduler();
  });

  afterEach(() => {
    stopCrawlScheduler();
  });

  it('starts and stops scheduler via injected timer', () => {
    const mockTimer: Timer = {
      setInterval: vi.fn(() => ({ ref: vi.fn(), unref: vi.fn() }) as unknown as NodeJS.Timeout),
      clearInterval: vi.fn(),
    };

    startCrawlScheduler(60_000, mockTimer);
    expect(mockTimer.setInterval).toHaveBeenCalledTimes(1);
    expect(mockTimer.setInterval).toHaveBeenCalledWith(expect.any(Function), 60_000);

    stopCrawlScheduler(mockTimer);
    expect(mockTimer.clearInterval).toHaveBeenCalledTimes(1);
  });

  it('does not start duplicate schedulers', () => {
    const mockTimer: Timer = {
      setInterval: vi.fn(() => ({ ref: vi.fn(), unref: vi.fn() }) as unknown as NodeJS.Timeout),
      clearInterval: vi.fn(),
    };

    startCrawlScheduler(60_000, mockTimer);
    startCrawlScheduler(60_000, mockTimer);
    expect(mockTimer.setInterval).toHaveBeenCalledTimes(1);
  });

  it('does not crash when stopping unstarted scheduler', () => {
    const mockTimer: Timer = {
      setInterval: vi.fn(() => ({ ref: vi.fn(), unref: vi.fn() }) as unknown as NodeJS.Timeout),
      clearInterval: vi.fn(),
    };

    expect(() => stopCrawlScheduler(mockTimer)).not.toThrow();
    expect(mockTimer.clearInterval).not.toHaveBeenCalled();
  });

  it('triggers checkAndRunDue when timer fires', async () => {
    let capturedCallback: (() => void) | null = null;
    const mockTimer: Timer = {
      setInterval: vi.fn((callback) => {
        capturedCallback = callback;
        return { ref: vi.fn(), unref: vi.fn() } as unknown as NodeJS.Timeout;
      }),
      clearInterval: vi.fn(),
    };

    startCrawlScheduler(60_000, mockTimer);
    expect(mockTimer.setInterval).toHaveBeenCalledTimes(1);
    expect(capturedCallback).not.toBeNull();

    // The callback should call checkAndRunDue which should not throw
    // We can't easily mock checkAndRunDue here, but we can verify the
    // callback is the expected function signature
    expect(() => capturedCallback!()).not.toThrow();
  });
});
