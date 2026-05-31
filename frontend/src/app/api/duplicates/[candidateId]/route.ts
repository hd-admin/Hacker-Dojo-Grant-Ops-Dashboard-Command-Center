import { NextResponse, type NextRequest, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.enum(['merge', 'keep-separate', 'defer']),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ candidateId: string }> }) {
  await connection();
  try {
    const { candidateId } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid duplicate payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const deps = getDependencies();
    const candidate = (await deps.repository.getDuplicateCandidates()).find((item) => item.id === candidateId);
    if (!candidate) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Candidate not found'), { status: 404 });
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
    logger.error({ err: error }, 'Error updating duplicate candidate');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to update duplicate candidate'), { status: 500 });
  }
}
