import { NextRequest, NextResponse } from 'next/server';
import { importBackupSnapshot } from '@/server/grant-ops/backup-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid backup payload' }, { status: 400 });
    }
    await importBackupSnapshot(body as never);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 });
  }
}
