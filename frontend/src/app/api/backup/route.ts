import { NextResponse } from 'next/server';
import { exportBackupSnapshot, recordBackupVerification } from '@/server/grant-ops/backup-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await exportBackupSnapshot();
    await recordBackupVerification(snapshot);
    return NextResponse.json(snapshot, {
      headers: { 'content-disposition': `attachment; filename=grant-ops-backup-${snapshot.manifest.createdAt}.json` },
    });
  } catch (error) {
    console.error('Error exporting backup:', error);
    return NextResponse.json({ error: 'Failed to export backup' }, { status: 500 });
  }
}
