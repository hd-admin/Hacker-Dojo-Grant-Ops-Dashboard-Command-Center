import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('crawl');
    return NextResponse.json({ jobId, sourceId: body.sourceId, message: 'Crawl job queued' }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Failed to start crawl', code: 'AGENT_TIMEOUT' }, { status: 500 });
  }
}
