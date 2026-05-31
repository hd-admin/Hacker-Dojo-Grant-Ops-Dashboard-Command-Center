import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { checkAndRunDue } from '@/server/grant-ops/crawl-scheduler-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const shouldTrigger = searchParams.get('trigger') === 'true';
    const triggered = shouldTrigger ? await checkAndRunDue() : 0;
    return NextResponse.json({ triggered });
  } catch (error) {
    logger.error({ err: error }, 'Error checking scheduled crawls');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to check scheduled crawls'), { status: 500 });
  }
}

export async function POST() {
  await connection();
  try {
    const triggered = await checkAndRunDue();
    return NextResponse.json({ triggered });
  } catch (error) {
    logger.error({ err: error }, 'Error triggering scheduled crawls');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to trigger scheduled crawls'), { status: 500 });
  }
}
