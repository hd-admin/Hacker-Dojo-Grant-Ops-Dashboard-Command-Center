import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  try {
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('peer');
    return NextResponse.json({ jobId, message: 'Peer discovery job queued' }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Failed to start peer discovery', code: 'AGENT_TIMEOUT' }, { status: 500 });
  }
}
