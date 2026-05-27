import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  canonicalValue: z.string(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ conflictId: string }> }) {
  try {
    const { conflictId } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid conflict payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const deps = getDependencies();
    const conflict = (await deps.repository.getConflictRecords()).find((item) => item.id === conflictId);
    if (!conflict) {
      return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });
    }

    const resolvedAt = new Date().toISOString();
    await deps.repository.updateConflictRecord(conflictId, {
      canonicalValue: parsed.data.canonicalValue,
      resolvedAt,
      resolvedBy: 'operator',
    });
    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'conflict_record_resolved',
      entityId: conflictId,
      entityType: 'conflict_record',
      actorLabel: 'operator',
      timestamp: resolvedAt,
      metadata: { canonicalValue: parsed.data.canonicalValue },
    });
    return NextResponse.json((await deps.repository.getConflictRecords()).find((item) => item.id === conflictId));
  } catch (error) {
    console.error('Error updating conflict record:', error);
    return NextResponse.json({ error: 'Failed to update conflict record' }, { status: 500 });
  }
}
