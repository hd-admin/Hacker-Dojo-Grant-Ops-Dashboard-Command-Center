import { NextRequest, NextResponse } from 'next/server';
import { loadSavedSearches, saveSavedSearches } from '../../../../../shared/grant-ops-persistence';
import type { SavedSearch } from '../../../../../shared/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const searches = await loadSavedSearches();
    return NextResponse.json(searches);
  } catch {
    return NextResponse.json({ error: 'Failed to load saved searches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'Failed to create saved search' }, { status: 500 });
  }
}
