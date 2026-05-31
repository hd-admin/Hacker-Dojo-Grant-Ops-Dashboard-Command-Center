import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { loadSavedSearches, saveSavedSearches } from '../../../../../../shared/grant-ops-persistence';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  name: z.string().min(1).optional(),
  queryText: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> },
) {
  await connection();
  try {
    const { searchId } = await params;
    const rawBody = await request.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid request body'), { status: 400 });
    }
    const body = parsed.data;
    const existing = await loadSavedSearches();
    const idx = existing.findIndex((s) => s.id === searchId);
    if (idx === -1) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Saved search not found'), { status: 404 });
    }
    existing[idx] = { ...existing[idx], ...body, id: searchId } as typeof existing[number];
    await saveSavedSearches(existing);
    return NextResponse.json(existing[idx]);
  } catch (error) {
    logger.error({ err: error }, 'Error updating saved search');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to update saved search'), { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> },
) {
  await connection();
  try {
    const { searchId } = await params;
    const existing = await loadSavedSearches();
    const filtered = existing.filter((s) => s.id !== searchId);
    if (filtered.length === existing.length) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Saved search not found'), { status: 404 });
    }
    await saveSavedSearches(filtered);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting saved search');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to delete saved search'), { status: 500 });
  }
}
