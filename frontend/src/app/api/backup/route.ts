import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { createBackupZip } from '@/server/grant-ops/backup-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const format = new URL(request.url).searchParams.get('format') || 'json';
    const snapshot = await deps.backup.exportBackupSnapshot();
    await deps.backup.recordBackupVerification(snapshot);

    if (format === 'zip') {
      const { zipPath, checksum } = await createBackupZip(snapshot);
      const fs = await import('node:fs/promises');
      const zipBuffer = await fs.readFile(zipPath);
      return new NextResponse(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="grant-ops-backup.zip"`,
          'X-Backup-Checksum': checksum,
        },
      });
    }

    return NextResponse.json(snapshot, {
      headers: { 'content-disposition': `attachment; filename=grant-ops-backup-${snapshot.manifest.createdAt}.json` },
    });
  } catch (error) {
    logger.error({ err: error }, 'Error exporting backup');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to export backup'), { status: 500 });
  }
}
