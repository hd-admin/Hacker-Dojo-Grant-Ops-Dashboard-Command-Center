import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const deps = getDependencies();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid backup payload' }, { status: 400 });
    }
    await deps.backup.importBackupSnapshot(body as never);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 });
  }
}
