import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  invalidateCache,
  loadCrawlSchedules,
  withTempDataDir,
} from '../../../../../../../../shared/grant-ops-persistence';
import type { CrawlSchedule } from '../../../../../../../../shared/types';

const mockSaveCrawlSchedule = vi.hoisted(() => vi.fn());

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

vi.mock('../../../../../../../../shared/grant-ops-persistence', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../../../../../shared/grant-ops-persistence')
  >('../../../../../../../../shared/grant-ops-persistence');
  return {
    ...actual,
    saveCrawlSchedule: mockSaveCrawlSchedule,
  };
});

import { POST } from './route';

describe('/api/sources/[sourceId]/schedule/mark-due route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let scheduleId: string;
  let sourceId: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    tempDataDir = await withTempDataDir();
    invalidateCache();

    sourceId = `test-source-${Date.now()}`;
    scheduleId = `test-sched-${Date.now()}`;

    mockSaveCrawlSchedule.mockImplementation(async (s: CrawlSchedule) => {
      const actual = await vi.importActual<
        typeof import('../../../../../../../../shared/grant-ops-persistence')
      >('../../../../../../../../shared/grant-ops-persistence');
      return actual.saveCrawlSchedule(s);
    });

    const schedule: CrawlSchedule = {
      id: scheduleId,
      sourceId,
      intervalHours: 24,
      nextScheduledAt: new Date(Date.now() + 3600000).toISOString(),
      isEnabled: true,
      createdAt: new Date().toISOString(),
    };
    await mockSaveCrawlSchedule(schedule);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns 200 and sets nextScheduledAt in the past on success', async () => {
    const before = await loadCrawlSchedules();
    const beforeSchedule = before.find((s) => s.id === scheduleId);
    expect(beforeSchedule).toBeDefined();
    const beforeTime = new Date(beforeSchedule!.nextScheduledAt).getTime();

    const response = await POST(
      new Request(`http://localhost/api/sources/${sourceId}/schedule/mark-due`, {
        method: 'POST',
      }) as never,
      {
        params: Promise.resolve({ sourceId }),
      },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const after = await loadCrawlSchedules();
    const afterSchedule = after.find((s) => s.id === scheduleId);
    expect(afterSchedule).toBeDefined();
    const afterTime = new Date(afterSchedule!.nextScheduledAt).getTime();

    expect(afterTime).toBeLessThan(beforeTime);
    expect(afterTime).toBeLessThan(Date.now());
  });

  it('returns 404 when schedule is not found for the given sourceId', async () => {
    const response = await POST(
      new Request('http://localhost/api/sources/nonexistent/schedule/mark-due', {
        method: 'POST',
      }) as never,
      {
        params: Promise.resolve({ sourceId: 'nonexistent' }),
      },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('FILE_NOT_FOUND');
    expect(data.error).toMatch(/Schedule not found/i);
  });

  it('returns 500 when persistence fails during save', async () => {
    mockSaveCrawlSchedule.mockRejectedValue(new Error('Disk full'));

    const response = await POST(
      new Request(`http://localhost/api/sources/${sourceId}/schedule/mark-due`, {
        method: 'POST',
      }) as never,
      {
        params: Promise.resolve({ sourceId }),
      },
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('STORAGE_UNAVAILABLE');
    expect(data.error).toMatch(/Failed to update schedule/i);
  });
});
