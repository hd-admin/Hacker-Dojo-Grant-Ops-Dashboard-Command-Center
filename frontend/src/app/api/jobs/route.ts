import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { JobQueueItem } from '../../../../../shared/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createJobSchema = z.object({
  type: z.enum([
    'research', 'draft', 'crawl', 'match', 'extract',
    'peer-discovery', 'funder-insights', 'eligibility-vetting', 'budget-import',
  ]),
  grantId: z.string().optional(),
  sourceId: z.string().optional(),
  params: z.record(z.unknown()).optional(),
});

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

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Request body must be a JSON object'),
        { status: 400 },
      );
    }

    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid job payload', {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        }),
        { status: 400 },
      );
    }

    const deps = getDependencies();
    const id = deps.idGenerator.generateId('job');
    const now = deps.clock.now().toISOString();

    const entityId = parsed.data.grantId ?? parsed.data.sourceId ?? undefined;
    const job: JobQueueItem = {
      id,
      jobType: parsed.data.type,
      status: 'queued',
      progress: 0,
      stage: 'queued',
      retryCount: 0,
      maxRetries: 3,
      createdAt: now,
    };
    if (entityId !== undefined) {
      job.entityId = entityId;
    }

    await deps.repository.addJobQueueItem(job);

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error creating job');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create job'),
      { status: 500 },
    );
  }
}
