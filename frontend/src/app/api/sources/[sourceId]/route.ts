import { NextRequest, NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { Source } from '../../../../../../shared/types';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  type: z.enum(['website', 'database', 'api']).optional(),
  category: z.enum(['foundation', 'government', 'corporate', 'community', 'other']).optional(),
  categoryRationale: z.string().optional(),
  crawlAccessCategory: z.enum(['crawlable', 'manual-only', 'unsupported']).optional(),
  authMethodDescription: z.string().optional(),
  crawlFrequencyRecommendation: z.string().optional(),
  operatorNotes: z.string().optional(),
  lastManualReviewDate: z.string().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  await connection();
  try {
    const { sourceId } = await params;
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid source update payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const deps = getDependencies();
    const source = (await deps.repository.getSources()).find((item) => item.id === sourceId);
    if (!source) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Source not found'), { status: 404 });
    }

    const updates: Partial<Source> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.url !== undefined) updates.url = parsed.data.url;
    if (parsed.data.type !== undefined) updates.type = parsed.data.type;
    if (parsed.data.category !== undefined) updates.category = parsed.data.category;
    if (parsed.data.categoryRationale !== undefined) updates.categoryRationale = parsed.data.categoryRationale;
    if (parsed.data.crawlAccessCategory !== undefined) updates.crawlAccessCategory = parsed.data.crawlAccessCategory;
    if (parsed.data.authMethodDescription !== undefined) updates.authMethodDescription = parsed.data.authMethodDescription;
    if (parsed.data.crawlFrequencyRecommendation !== undefined) updates.crawlFrequencyRecommendation = parsed.data.crawlFrequencyRecommendation;
    if (parsed.data.operatorNotes !== undefined) updates.operatorNotes = parsed.data.operatorNotes;
    if (parsed.data.lastManualReviewDate !== undefined) updates.lastManualReviewDate = parsed.data.lastManualReviewDate;
    await deps.repository.updateSource(sourceId, updates);
    const updated = (await deps.repository.getSources()).find((item) => item.id === sourceId);
    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'source_edited',
      entityId: sourceId,
      entityType: 'source',
      actorLabel: 'operator',
      timestamp: new Date().toISOString(),
      metadata: { fields: Object.keys(parsed.data) },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Error updating source');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to update source'), { status: 500 });
  }
}
