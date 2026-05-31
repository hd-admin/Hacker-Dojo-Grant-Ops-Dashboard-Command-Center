import { NextRequest, NextResponse, connection } from "next/server";
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'categorize']),
  reason: z.string().optional(),
  category: z.enum(['foundation', 'government', 'corporate', 'community', 'other']).optional(),
  categoryRationale: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  await connection();
  try {
    const { sourceId } = await params;
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: 'Invalid review payload', issues: body.error.flatten() }, { status: 400 });
    }

    const deps = getDependencies();
    const source = (await deps.repository.getSources()).find((item) => item.id === sourceId);
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    if (body.data.action === 'approve') {
      await deps.repository.updateSource(sourceId, {
        reviewStatus: 'approved',
        approvedAt: now,
        lastManualReviewDate: now,
        isActive: true,
        ...(body.data.category ? { category: body.data.category } : {}),
        ...(body.data.categoryRationale ? { categoryRationale: body.data.categoryRationale } : {}),
      });
    } else if (body.data.action === 'reject') {
      await deps.repository.updateSource(sourceId, {
        reviewStatus: 'rejected',
        rejectionReason: body.data.reason ?? '',
        isActive: false,
      });
    } else {
      await deps.repository.updateSource(sourceId, {
        ...(body.data.category ? { category: body.data.category } : {}),
        ...(body.data.categoryRationale ? { categoryRationale: body.data.categoryRationale } : {}),
      });
    }

    const updated = (await deps.repository.getSources()).find((item) => item.id === sourceId)!;
    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'source_review_actioned',
      entityId: sourceId,
      entityType: 'source',
      actorLabel: 'operator',
      timestamp: now,
      metadata: { action: body.data.action, reason: body.data.reason, category: body.data.category },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error reviewing source:', error);
    return NextResponse.json({ error: 'Failed to review source' }, { status: 500 });
  }
}
