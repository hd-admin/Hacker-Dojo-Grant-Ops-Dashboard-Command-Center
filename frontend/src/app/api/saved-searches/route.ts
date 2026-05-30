import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const savedSearches: { id: string; name: string; queryText: string; filters: Record<string, unknown>; newResultsCount: number; lastCheckedAt: string; createdAt: string }[] = [];

export async function GET() {
  return NextResponse.json(savedSearches);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const search = {
      id: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: body.name || 'Untitled',
      queryText: body.queryText || '',
      filters: body.filters || {},
      newResultsCount: 0,
      lastCheckedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    savedSearches.push(search);
    return NextResponse.json(search, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create saved search' }, { status: 500 });
  }
}
