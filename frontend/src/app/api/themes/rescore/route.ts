import { NextResponse, connection } from "next/server";
import { logger } from '@/lib/logger';
import { createErrorResponse } from '@/lib/api-error-handler';
import { loadGrants, saveGrants } from '../../../../../../shared/grant-ops-persistence';
import { scoreGrantByThemes } from '@/server/grant-ops/theme-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  await connection();
  try {
    const grants = await loadGrants();
    let changed = 0;
    const updated = await Promise.all(
      grants.map(async (grant) => {
        const newScore = await scoreGrantByThemes(grant.tags);
        if (newScore !== grant.fit) {
          changed++;
          return { ...grant, fit: newScore };
        }
        return grant;
      }),
    );
    if (changed > 0) await saveGrants(updated);
    return NextResponse.json({ success: true, rescored: changed });
  } catch (error) {
    logger.error({ err: error }, '[themes/rescore] failed');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 },
    );
  }
}
