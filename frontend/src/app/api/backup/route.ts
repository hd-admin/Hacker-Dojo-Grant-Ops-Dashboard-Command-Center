import { NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const deps = getDependencies();
    const snapshot = await deps.backup.exportBackupSnapshot();
    await deps.backup.recordBackupVerification(snapshot);
    return NextResponse.json(snapshot, {
      headers: { 'content-disposition': `attachment; filename=grant-ops-backup-${snapshot.manifest.createdAt}.json` },
    });
  } catch (error) {
    console.error('Error exporting backup:', error);
    return NextResponse.json({ error: 'Failed to export backup' }, { status: 500 });
  }
}
