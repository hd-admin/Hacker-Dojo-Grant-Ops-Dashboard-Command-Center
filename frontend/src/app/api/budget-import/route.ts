import { NextRequest, NextResponse, connection } from "next/server";
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => ({}));
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('bi');
    return NextResponse.json({ jobId, awardId: body.awardId, message: 'Budget import job queued' }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Failed to start budget import', code: 'AGENT_TIMEOUT' }, { status: 500 });
  }
}
