import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { loadSavedSearches, saveSavedSearches } from '../../../../../shared/grant-ops-persistence';
import type { SavedSearch } from '../../../../../shared/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connection();
  try {
    const searches = await loadSavedSearches();
    return NextResponse.json(searches);
  } catch {
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to load saved searches'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json();
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
  } catch {
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create saved search'), { status: 500 });
  }
}
