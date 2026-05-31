import { NextRequest, NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

const awardSchema = z.object({
  grantId: z.string(),
  funder: z.string(),
  title: z.string(),
  amount: z.number().default(0),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  status: z.enum(['active', 'completed', 'terminated', 'pending']).default('active'),
  awardLetterPath: z.string().default(''),
  notes: z.string().default(''),
});

export async function GET(_request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const awards = await deps.repository.getAwards?.() ?? [];
    return NextResponse.json({ awards });
  } catch (error) {
    console.error('Error getting awards:', error);
    return NextResponse.json({ error: 'Failed to get awards' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    const parsed = awardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid award payload', details: parsed.error.format() }, { status: 400 });
    }
    const deps = getDependencies();
    const award = {
      id: deps.idGenerator.generateId('award'),
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    await deps.repository.createAward?.(award);
    return NextResponse.json({ award }, { status: 201 });
  } catch (error) {
    console.error('Error creating award:', error);
    return NextResponse.json({ error: 'Failed to create award' }, { status: 500 });
  }
}
