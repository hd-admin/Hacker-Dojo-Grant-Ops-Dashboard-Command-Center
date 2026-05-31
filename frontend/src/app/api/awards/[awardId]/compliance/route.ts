import { NextRequest, NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

const complianceSchema = z.object({
  requirement: z.string().default(''),
  dueDate: z.string().default(''),
  status: z.enum(['pending', 'completed', 'overdue', 'waived']).default('pending'),
  completedAt: z.string().default(''),
  notes: z.string().default(''),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ awardId: string }> }) {
  await connection();
  try {
    const { awardId } = await params;
    const deps = getDependencies();
    const items = await deps.repository.getComplianceItemsByAwardId?.(awardId) ?? [];
    return NextResponse.json({ compliance: items });
  } catch (error) {
    console.error('Error getting compliance:', error);
    return NextResponse.json({ error: 'Failed to get compliance items' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ awardId: string }> }) {
  await connection();
  try {
    const { awardId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = complianceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid compliance payload', details: parsed.error.format() }, { status: 400 });
    }
    const deps = getDependencies();
    const item = {
      id: deps.idGenerator.generateId('compliance'),
      awardId,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    await deps.repository.createComplianceItem?.(item);
    return NextResponse.json({ compliance: item });
  } catch (error) {
    console.error('Error updating compliance:', error);
    return NextResponse.json({ error: 'Failed to update compliance item' }, { status: 500 });
  }
}
