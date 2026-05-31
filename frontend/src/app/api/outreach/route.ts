import { NextRequest, NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

const outreachSchema = z.object({
  grantId: z.string(),
  funderId: z.string().optional(),
  contactName: z.string().default(''),
  contactEmail: z.string().default(''),
  method: z.enum(['email', 'phone', 'meeting', 'other']).default('email'),
  notes: z.string().default(''),
  outcome: z.enum(['', 'no-response', 'positive', 'negative', 'follow-up-needed']).default(''),
  followUpDate: z.string().default(''),
});

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get('grantId');
    const deps = getDependencies();
    const records = (await deps.repository.getOutreachRecords?.() ?? []) as Record<string, unknown>[];
    const filtered = grantId ? records.filter((r) => r.grantId === grantId) : records;
    return NextResponse.json({ outreach: filtered });
  } catch (error) {
    console.error('Error getting outreach:', error);
    return NextResponse.json({ error: 'Failed to get outreach records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    const parsed = outreachSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid outreach payload', details: parsed.error.format() }, { status: 400 });
    }
    const deps = getDependencies();
    const record = {
      id: deps.idGenerator.generateId('outreach'),
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    await deps.repository.createOutreachRecord?.(record);
    return NextResponse.json({ outreach: record }, { status: 201 });
  } catch (error) {
    console.error('Error creating outreach:', error);
    return NextResponse.json({ error: 'Failed to create outreach record' }, { status: 500 });
  }
}
