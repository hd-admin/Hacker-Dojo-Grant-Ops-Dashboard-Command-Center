import { NextResponse, connection } from "next/server";
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST() {
  await connection();
  const deps = getDependencies();
  await deps.resetPersistentStateForTests();
  return NextResponse.json({ success: true });
}
