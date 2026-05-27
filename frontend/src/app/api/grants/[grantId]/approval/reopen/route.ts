import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  reason: z.string().min(10),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  try {
    const { grantId } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid reopen payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const deps = getDependencies();
    const approval = await deps.repository.getApprovalRecord(grantId);
    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    await deps.repository.removeApprovalRecord(grantId);
    await deps.repository.updateGrant(grantId, { status: 'draft', statusLabel: 'Drafting' });
    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'draft_reopened',
      entityId: grantId,
      entityType: 'grant',
      actorLabel: 'operator',
      timestamp: new Date().toISOString(),
      metadata: { reason: parsed.data.reason, previousApprovedBy: approval.approvedBy },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reopening approval:', error);
    return NextResponse.json({ error: 'Failed to reopen approval' }, { status: 500 });
  }
}
