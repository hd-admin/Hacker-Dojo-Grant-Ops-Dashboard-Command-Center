import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('match');
    return NextResponse.json({ jobId, grantIds: body.grantIds || [], message: 'Match scoring job queued' }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Failed to start match scoring', code: 'AGENT_TIMEOUT' }, { status: 500 });
  }
}
