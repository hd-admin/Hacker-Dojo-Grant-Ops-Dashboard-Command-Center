import { NextRequest, NextResponse, connection } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
import ical, { ICalAlarmType } from 'ical-generator';
import fs from 'node:fs';
import path from 'node:path';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'all';
    const deps = getDependencies();

    const calendar = ical({ name: 'Hacker Dojo Grant Ops', prodId: { company: 'Hacker Dojo', product: 'Grant Ops' } });

    if (scope === 'all' || scope === 'grants') {
      const grants = await deps.repository.getGrants();
      for (const grant of grants) {
        if (grant.deadline && grant.deadline !== 'Rolling') {
          const deadline = new Date(grant.deadline);
          if (!isNaN(deadline.getTime())) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (calendar as any).createEvent({
              start: deadline,
              end: deadline,
              summary: `${grant.title} (Deadline)`,
              description: `Grant deadline for ${grant.funder}`,
              uid: `${grant.id}@hackerdojo.org`,
              alarms: [
                { type: ICalAlarmType.display, trigger: 86400, description: '24h before deadline' },
                { type: ICalAlarmType.display, trigger: 3600, description: '1h before deadline' },
              ],
            });
          }
        }
      }
    }

    if (scope === 'all' || scope === 'reports') {
      const awards = await deps.repository.getAwards?.() ?? [];
      for (const award of awards) {
        const reports = await deps.repository.getReportDeadlinesByAwardId?.(award.id) ?? [];
        for (const report of reports) {
          if (report.dueDate) {
            const dueDate = new Date(report.dueDate);
            if (!isNaN(dueDate.getTime())) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (calendar as any).createEvent({
                start: dueDate,
                end: dueDate,
                summary: `${report.reportType} Report — ${award.title}`,
                description: `Report deadline for ${award.funder}`,
                uid: `${report.id}@hackerdojo.org`,
                alarms: [
                  { type: ICalAlarmType.display, trigger: 172800, description: '48h before report due' },
                ],
              });
            }
          }
        }
      }
    }

    const icsContent = calendar.toString();

    // Save to exports directory
    const exportsDir = path.join(process.cwd(), '.grant-ops-data', 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });
    fs.writeFileSync(path.join(exportsDir, 'calendar.ics'), icsContent, 'utf8');

    return new NextResponse(icsContent, {
      headers: {
        'Content-Type': 'text/calendar',
        'Content-Disposition': 'attachment; filename="grant-ops-calendar.ics"',
      },
    });
  } catch (error) {
    console.error('Error exporting calendar:', error);
    return NextResponse.json({ error: 'Failed to export calendar' }, { status: 500 });
  }
}
