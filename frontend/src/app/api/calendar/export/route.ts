import { NextRequest, NextResponse, connection } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'all';
    const deps = getDependencies();

    // Build simple ICS content
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Hacker Dojo//Grant Ops//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    if (scope === 'all' || scope === 'grants') {
      const grants = await deps.repository.getGrants();
      for (const grant of grants) {
        if (grant.deadline && grant.deadline !== 'Rolling') {
          const deadline = new Date(grant.deadline);
          if (!isNaN(deadline.getTime())) {
            const uid = `${grant.id}@hackerdojo.org`;
            const dtstart = deadline.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            lines.push(
              'BEGIN:VEVENT',
              `UID:${uid}`,
              `SUMMARY:${grant.title} (Deadline)`,
              `DTSTART:${dtstart}`,
              `DTEND:${dtstart}`,
              `DESCRIPTION:Grant deadline for ${grant.funder}`,
              'BEGIN:VALARM',
              'ACTION:DISPLAY',
              'DESCRIPTION:Reminder',
              'TRIGGER:-P1D',
              'END:VALARM',
              'END:VEVENT'
            );
          }
        }
      }
    }

    lines.push('END:VCALENDAR');
    const icsContent = lines.join('\r\n');

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
