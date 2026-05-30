import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../shared/grant-ops-persistence';
import { saveCrawlSchedule, loadCrawlSchedules } from '../../../../shared/grant-ops-persistence';
import { defaultProfile } from '../../../../shared/seed-data';
import * as repository from './repository';

import { checkAndRunDue, disableScheduleForSource, getScheduleForSource, upsertScheduleForSource } from './crawl-scheduler-service';

const runResearchMock = vi.hoisted(() => vi.fn(async () => ({
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
})));

vi.mock('./research-service', () => ({ runResearch: runResearchMock }));

describe('crawl-scheduler-service', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
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

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('upserts schedules with the expected next run time', async () => {
    const schedule = await upsertScheduleForSource('source-1', 12);

    expect(schedule.sourceId).toBe('source-1');
    expect(schedule.intervalHours).toBe(12);
    expect(new Date(schedule.nextScheduledAt).getTime()).toBeGreaterThan(Date.now());
    expect(await getScheduleForSource('source-1')).toMatchObject({ id: schedule.id, isEnabled: true });
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
