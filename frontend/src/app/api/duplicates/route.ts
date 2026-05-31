import { NextRequest, NextResponse, connection } from "next/server";
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const deps = getDependencies();
    const duplicates = await deps.repository.getDuplicateCandidates(status);
    return NextResponse.json(duplicates);
  } catch (error) {
    console.error('Error listing duplicates:', error);
    return NextResponse.json({ error: 'Failed to list duplicates' }, { status: 500 });
  }
}
