import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';

export async function GET(_request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const awards = await deps.repository.getAwards?.() ?? [];
    const reports = [];
    for (const award of awards as unknown as Array<{ id: string; title: string; funder: string }>) {
      const awardReports = (await deps.repository.getReportDeadlinesByAwardId?.(award.id) ?? []) as unknown as Record<string, unknown>[];
      reports.push(...awardReports.map((r) => ({
        ...r,
        awardTitle: award.title,
        awardFunder: award.funder,
      })));
    }
    return NextResponse.json({ reports });
  } catch (error) {
    logger.error({ err: error }, 'Error getting reports');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get reports'), { status: 500 });
  }
}
