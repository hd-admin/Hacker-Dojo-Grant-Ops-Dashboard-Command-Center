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
    const entityId = searchParams.get('entityId');
    const entityType = searchParams.get('entityType');

    const events = await deps.repository.getAuditEvents(100);
    const filtered = events
      .filter((event) => (entityId ? event.entityId === entityId : true))
      .filter((event) => (entityType ? event.entityType === entityType : true))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return NextResponse.json(filtered);
  } catch (error) {
    logger.error({ err: error }, 'Error listing audit events');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to list audit events'), { status: 500 });
  }
}
