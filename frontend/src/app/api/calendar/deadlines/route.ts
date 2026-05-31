import { NextRequest, NextResponse, connection } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export async function GET(_request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const grants = await deps.repository.getGrants();
    const deadlines = grants
      .filter((g) => g.deadline && g.deadline !== 'Rolling')
      .map((g) => ({
        id: g.id,
        title: g.title,
        funder: g.funder,
        deadline: g.deadline,
        status: g.status,
        type: 'grant' as const,
      }));
    return NextResponse.json({ deadlines });
  } catch (error) {
    console.error('Error getting deadlines:', error);
    return NextResponse.json({ error: 'Failed to get deadlines' }, { status: 500 });
  }
}
