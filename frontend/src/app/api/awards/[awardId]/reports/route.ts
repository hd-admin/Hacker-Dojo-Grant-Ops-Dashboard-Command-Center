import { NextRequest, NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

const reportSchema = z.object({
  reportType: z.string().default(''),
  dueDate: z.string().default(''),
  status: z.enum(['pending', 'submitted', 'overdue']).default('pending'),
  submittedAt: z.string().default(''),
  submittedBy: z.string().default(''),
  notes: z.string().default(''),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ awardId: string }> }) {
  await connection();
  try {
    const { awardId } = await params;
    const deps = getDependencies();
    const reports = await deps.repository.getReportDeadlinesByAwardId?.(awardId) ?? [];
    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error getting reports:', error);
    return NextResponse.json({ error: 'Failed to get reports' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ awardId: string }> }) {
  await connection();
  try {
    const { awardId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid report payload', details: parsed.error.format() }, { status: 400 });
    }
    const deps = getDependencies();
    const report = {
      id: deps.idGenerator.generateId('report'),
      awardId,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    await deps.repository.createReportDeadline?.(report);
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}
