import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { getSessionLogPath } from '@/lib/logger';
import fs from 'node:fs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  await connection();
  try {
    const { jobId } = await params;
    const logPath = getSessionLogPath(jobId);
    if (!fs.existsSync(logPath)) {
      return NextResponse.json(
        { entries: [], count: 0, note: 'No session log found for this job' },
        { status: 200 },
      );
    }
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return NextResponse.json({ entries: lines, count: lines.length });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error({ err: error }, 'Error reading session log');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to read session log'), { status: 500 });
  }
}
