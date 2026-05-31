import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { loadSavedSearches, saveSavedSearches } from '../../../../../shared/grant-ops-persistence';
import type { SavedSearch } from '../../../../../shared/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  name: z.string().min(1),
  queryText: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
});

export async function GET() {
  await connection();
  try {
    const searches = await loadSavedSearches();
    return NextResponse.json(searches);
  } catch (error) {
    logger.error({ err: error }, 'Error loading saved searches');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to load saved searches'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const rawBody = await request.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Name is required'), { status: 400 });
    }
    const body = parsed.data;
    const existing = await loadSavedSearches();
    const search: SavedSearch = {
      id: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: body.name || 'Untitled',
      queryText: body.queryText || '',
      filters: body.filters || {},
      newResultsCount: 0,
      lastCheckedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    existing.push(search);
    await saveSavedSearches(existing);
    return NextResponse.json(search, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error creating saved search');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create saved search'), { status: 500 });
  }
}
