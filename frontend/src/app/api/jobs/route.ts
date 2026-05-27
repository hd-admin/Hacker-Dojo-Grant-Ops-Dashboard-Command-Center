import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const deps = getDependencies();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const jobs = await deps.repository.getJobQueue(status);
    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Error listing jobs:', error);
    return NextResponse.json({ error: 'Failed to list jobs' }, { status: 500 });
  }
}
