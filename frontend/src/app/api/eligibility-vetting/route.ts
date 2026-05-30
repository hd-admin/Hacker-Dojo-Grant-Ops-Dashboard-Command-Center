import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const deps = getDependencies();
    const jobId = deps.idGenerator.generateId('ev');
    return NextResponse.json({ jobId, grantId: body.grantId, message: 'Eligibility vetting job queued' }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Failed to start eligibility vetting', code: 'AGENT_TIMEOUT' }, { status: 500 });
  }
}
