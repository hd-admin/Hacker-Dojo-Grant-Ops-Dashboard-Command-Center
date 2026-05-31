import { NextRequest, NextResponse, connection } from "next/server";
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get('grantId') ?? undefined;
    const deps = getDependencies();
    return NextResponse.json(await deps.repository.getConflictRecords(grantId));
  } catch (error) {
    console.error('Error listing conflicts:', error);
    return NextResponse.json({ error: 'Failed to list conflicts' }, { status: 500 });
  }
}
