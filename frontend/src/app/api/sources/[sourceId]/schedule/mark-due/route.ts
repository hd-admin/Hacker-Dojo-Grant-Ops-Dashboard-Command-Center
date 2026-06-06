import { NextRequest, NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { revalidateAfterMutation } from '@/lib/revalidate';
import {
  loadCrawlSchedules,
  saveCrawlSchedule,
} from '../../../../../../../../shared/grant-ops-persistence';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  sourceId: z.string().min(1),
});

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
): Promise<NextResponse> {
  await connection();
  const { sourceId } = await params;
  if (!paramsSchema.safeParse({ sourceId }).success) {
    return NextResponse.json(
      createErrorResponse('VALIDATION_ERROR', 'Invalid source ID'),
      { status: 400 },
    );
  }
  const schedules = await loadCrawlSchedules();
  const schedule = schedules.find((s) => s.sourceId === sourceId);
  if (!schedule) {
    return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Schedule not found'), {
      status: 404,
    });
  }
  schedule.nextScheduledAt = new Date(Date.now() - 1000).toISOString();
  try {
    await saveCrawlSchedule(schedule);
    revalidateAfterMutation();
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error marking schedule due');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to update schedule'),
      { status: 500 },
    );
  }
}
