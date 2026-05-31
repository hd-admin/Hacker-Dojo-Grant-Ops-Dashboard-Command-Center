import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';

export async function GET(_request: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const awards = await deps.repository.getAwards?.() ?? [];
    const alerts: { awardId: string; type: 'under' | 'over'; category: string }[] = [];

    for (const award of awards) {
      const categories = await deps.repository.getBudgetCategoriesByAwardId?.(award.id) ?? [];
      for (const cat of categories) {
        if (cat.budgeted > 0) {
          const pct = (cat.spent || 0) / cat.budgeted;
          if (pct > 1.0) {
            alerts.push({ awardId: award.id, type: 'over', category: cat.category });
          } else if (pct < 0.1 && (cat.spent || 0) > 0) {
            alerts.push({ awardId: award.id, type: 'under', category: cat.category });
          }
        }
      }
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    logger.error({ err: error }, 'Error getting spenddown alerts');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get alerts'), { status: 500 });
  }
}
