import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.enum(['merge', 'keep-separate', 'defer']),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  try {
    const { candidateId } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid duplicate payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const deps = getDependencies();
    const candidate = (await deps.repository.getDuplicateCandidates()).find((item) => item.id === candidateId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const status = parsed.data.action === 'merge' ? 'merged' : parsed.data.action === 'keep-separate' ? 'kept-separate' : 'deferred';
    const resolvedAt = new Date().toISOString();
    await deps.repository.updateDuplicateCandidate(candidateId, {
      status,
      resolvedAt,
      resolvedBy: 'operator',
    });
    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'duplicate_candidate_resolved',
      entityId: candidateId,
      entityType: 'duplicate_candidate',
      actorLabel: 'operator',
      timestamp: resolvedAt,
      metadata: { action: parsed.data.action, status },
    });
    return NextResponse.json((await deps.repository.getDuplicateCandidates()).find((item) => item.id === candidateId));
  } catch (error) {
    console.error('Error updating duplicate candidate:', error);
    return NextResponse.json({ error: 'Failed to update duplicate candidate' }, { status: 500 });
  }
}
