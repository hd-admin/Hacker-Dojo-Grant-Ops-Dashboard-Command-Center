import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const type = searchParams.get('type') ?? undefined;
    const jobs = await deps.repository.getJobQueue(status);

    // Client-side filtering by jobType if type parameter is provided
    let filtered = Array.isArray(jobs) ? jobs : [];
    if (type && (type === 'research' || type === 'draft')) {
      filtered = filtered.filter((job) => job.jobType === type);
    }

    return NextResponse.json(filtered);
  } catch (error) {
    logger.error({ err: error }, 'Error listing jobs');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to list jobs'), { status: 500 });
  }
}
