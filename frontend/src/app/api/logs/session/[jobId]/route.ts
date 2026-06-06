import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { getSessionLogPath } from '@/lib/logger';
import fs from 'node:fs';
import { z } from 'zod';

const querySchema = z
  .object({
    page: z.preprocess(
      (val) => (val === null || val === undefined ? undefined : Number(val)),
      z.number().int().min(1).optional(),
    ),
    pageSize: z.preprocess(
      (val) => (val === null || val === undefined ? undefined : Number(val)),
      z.number().int().min(1).max(200).optional(),
    ),
  })
  .transform((data) => ({
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 50,
  }));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  await connection();
  try {
    const { jobId } = await params;
    const { searchParams } = new URL(request.url);
    const query = querySchema.safeParse({
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
    });

    if (!query.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid pagination parameters'),
        { status: 400 },
      );
    }

    const { page, pageSize } = query.data;

    const logPath = getSessionLogPath(jobId);
    if (!fs.existsSync(logPath)) {
      return NextResponse.json(
        {
          entries: [],
          count: 0,
          page,
          pageSize,
          totalEntries: 0,
          note: 'No session log found for this job',
        },
        { status: 200 },
      );
    }
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const totalEntries = lines.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const entries = lines.slice(start, end);
    const count = entries.length;

    return NextResponse.json({ entries, count, page, pageSize, totalEntries });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error({ err: error }, 'Error reading session log');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to read session log'),
      { status: 500 },
    );
  }
}
