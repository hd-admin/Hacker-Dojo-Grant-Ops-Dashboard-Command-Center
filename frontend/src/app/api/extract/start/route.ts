import { NextRequest, NextResponse, connection } from "next/server";
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => ({}));
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('ext');
    return NextResponse.json({ jobId, documentRef: body.documentRef, grantId: body.grantId, message: 'Extract job queued' }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Failed to start extraction', code: 'AGENT_TIMEOUT' }, { status: 500 });
  }
}
