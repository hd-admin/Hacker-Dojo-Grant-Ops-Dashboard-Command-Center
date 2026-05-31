import { NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connection();
  try {
    const deps = getDependencies();
    const snapshot = await deps.backup.exportBackupSnapshot();
    await deps.backup.recordBackupVerification(snapshot);
    return NextResponse.json(snapshot, {
      headers: { 'content-disposition': `attachment; filename=grant-ops-backup-${snapshot.manifest.createdAt}.json` },
    });
  } catch (error) {
    logger.error({ err: error }, 'Error exporting backup');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to export backup'), { status: 500 });
  }
}
