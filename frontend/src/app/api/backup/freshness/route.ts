import { NextResponse, connection } from "next/server";
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connection();
  try {
    const deps = getDependencies();
    return NextResponse.json(await deps.loadBackupFreshness());
  } catch (error) {
    console.error('Error loading backup freshness:', error);
    return NextResponse.json({ error: 'Failed to load backup freshness' }, { status: 500 });
  }
}
