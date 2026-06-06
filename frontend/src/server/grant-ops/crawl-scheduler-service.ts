import 'server-only';
import { logger } from '@/lib/logger';
import type { CrawlSchedule } from '../../../../shared/types';
import {
  deleteCrawlSchedule,
  loadCrawlSchedules,
  saveCrawlSchedule,
} from '../../../../shared/grant-ops-persistence';
import { getDependencies } from './dependencies';
import { runResearch } from './research-service';

let schedulerHandle: NodeJS.Timeout | null = null;

export interface Timer {
  setInterval(callback: () => void, ms: number): NodeJS.Timeout;
  clearInterval(handle: NodeJS.Timeout | null): void;
}

const defaultTimer: Timer = {
  setInterval: (callback, ms) => global.setInterval(callback, ms),
  clearInterval: (handle) => {
    if (handle) global.clearInterval(handle);
  },
};

function addHours(date: Date, hours: number): string {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export async function getScheduleForSource(sourceId: string): Promise<CrawlSchedule | null> {
  const schedules = await loadCrawlSchedules();
  return schedules.find((schedule) => schedule.sourceId === sourceId) ?? null;
}

export async function upsertScheduleForSource(
  sourceId: string,
  intervalHours: number,
  isEnabled = true,
): Promise<CrawlSchedule> {
  const now = new Date();
  const existing = await getScheduleForSource(sourceId);
  const schedule: CrawlSchedule = {
    id: existing?.id ?? `schedule-${sourceId}`,
    sourceId,
    intervalHours,
    lastScheduledAt: now.toISOString(),
    nextScheduledAt: addHours(now, intervalHours),
    isEnabled,
    createdAt: existing?.createdAt ?? now.toISOString(),
  };
  await saveCrawlSchedule(schedule);
  return schedule;
}

export async function disableScheduleForSource(sourceId: string): Promise<void> {
  const schedule = await getScheduleForSource(sourceId);
  if (!schedule) return;
  await deleteCrawlSchedule(schedule.id);
}

export async function checkAndRunDue(): Promise<number> {
  const now = new Date();
  const schedules = await loadCrawlSchedules();
  const dueSchedules = schedules.filter(
    (schedule) => schedule.isEnabled && new Date(schedule.nextScheduledAt) <= now,
  );
  if (dueSchedules.length === 0) {
    return 0;
  }

  const deps = getDependencies();
  const profile = await deps.repository.getOrgProfile();
  if (!profile) {
    return 0;
  }

  for (const schedule of dueSchedules) {
    // Approval gate: skip sources that are not approved
    const source = await deps.repository
      .getSources()
      .then((all) => all.find((s) => s.id === schedule.sourceId));
    if (!source || source.reviewStatus !== 'approved' || !source.isActive) {
      logger.warn(
        `Skipping scheduled crawl for source ${schedule.sourceId}: not approved or inactive`,
      );
      // Update next schedule time to skip this cycle but keep schedule
      schedule.lastScheduledAt = now.toISOString();
      schedule.nextScheduledAt = addHours(now, schedule.intervalHours);
      await saveCrawlSchedule(schedule);
      continue;
    }

    await runResearch(profile, { sourceIds: [schedule.sourceId] });
    schedule.lastScheduledAt = now.toISOString();
    schedule.nextScheduledAt = addHours(now, schedule.intervalHours);
    await saveCrawlSchedule(schedule);
  }

  return dueSchedules.length;
}

export function startCrawlScheduler(
  intervalMs = 60_000,
  timer: Timer = defaultTimer,
): void {
  if (schedulerHandle) return;
  schedulerHandle = timer.setInterval(() => {
    void checkAndRunDue().catch((error) => logger.error({ err: error }, 'Crawl scheduler failed'));
  }, intervalMs);
}

export function stopCrawlScheduler(timer: Timer = defaultTimer): void {
  if (!schedulerHandle) return;
  timer.clearInterval(schedulerHandle);
  schedulerHandle = null;
}
