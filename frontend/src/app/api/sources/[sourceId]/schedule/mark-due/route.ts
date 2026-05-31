import { NextRequest, NextResponse, connection } from "next/server";
import { loadCrawlSchedules, saveCrawlSchedule } from '../../../../../../../../shared/grant-ops-persistence';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  await connection();
  const { sourceId } = await params;
  const schedules = await loadCrawlSchedules();
  const schedule = schedules.find((s) => s.sourceId === sourceId);
  if (!schedule) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
  }
  schedule.nextScheduledAt = new Date(Date.now() - 1000).toISOString();
  await saveCrawlSchedule(schedule);
  return NextResponse.json({ success: true });
}
