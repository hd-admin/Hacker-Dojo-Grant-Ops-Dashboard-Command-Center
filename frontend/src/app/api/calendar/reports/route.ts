import { NextRequest, NextResponse, connection } from 'next/server';
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
    console.error('Error getting reports:', error);
    return NextResponse.json({ error: 'Failed to get reports' }, { status: 500 });
  }
}
