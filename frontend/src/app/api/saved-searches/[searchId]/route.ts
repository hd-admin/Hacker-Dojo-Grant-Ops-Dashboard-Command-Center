import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { loadSavedSearches, saveSavedSearches } from '../../../../../../shared/grant-ops-persistence';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> },
) {
  await connection();
  try {
    const { searchId } = await params;
    const body = await request.json();
    const existing = await loadSavedSearches();
    const idx = existing.findIndex((s) => s.id === searchId);
    if (idx === -1) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Saved search not found'), { status: 404 });
    }
    existing[idx] = { ...existing[idx], ...body, id: searchId };
    await saveSavedSearches(existing);
    return NextResponse.json(existing[idx]);
  } catch {
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
  } catch {
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to delete saved search'), { status: 500 });
  }
}
