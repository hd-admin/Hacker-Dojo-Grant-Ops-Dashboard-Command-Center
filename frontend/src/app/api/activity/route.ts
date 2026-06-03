import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import type { AuditEvent } from '../../../../../shared/types';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    const parsed = querySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', {
          validationErrors: parsed.error.format(),
        }),
        { status: 400 },
      );
    }
    const { page, pageSize, entityType, entityId } = parsed.data;

    const { getSqliteState, readAuditEvents } =
      await import('../../../../../shared/grant-ops-sqlite');
    const allEvents: AuditEvent[] = readAuditEvents(getSqliteState());

    let filtered = allEvents;
    if (entityId) {
      filtered = filtered.filter((e: AuditEvent) => e.entityId === entityId);
    }
    if (entityType) {
      filtered = filtered.filter((e: AuditEvent) => e.entityType === entityType);
    }
    filtered.sort((a: AuditEvent, b: AuditEvent) => b.timestamp.localeCompare(a.timestamp));

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);

    return NextResponse.json({ events: paginated, total, page, pageSize });
  } catch (error) {
    logger.error({ err: error }, 'Error listing activity events');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to list activity events'),
      { status: 500 },
    );
  }
}
