import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { Grant, GrantStatus } from '../../../../../../../shared/types';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  field: z.string(),
  newValue: z.unknown(),
  rationale: z.string().min(1),
  overrideType: z.enum(['score', 'category', 'task', 'status']),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  try {
    const { grantId } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid override payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const deps = getDependencies();
    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    const override = {
      field: parsed.data.field,
      previousValue: Reflect.get(grant, parsed.data.field),
      newValue: parsed.data.newValue,
      rationale: parsed.data.rationale,
      overriddenAt: new Date().toISOString(),
      overriddenBy: 'operator',
      overrideType: parsed.data.overrideType,
    };

    const humanOverrides = [...(grant.humanOverrides ?? []), override];
    const updates: Partial<Grant> = { humanOverrides };
    switch (parsed.data.field) {
      case 'status':
        updates.status = parsed.data.newValue as GrantStatus;
        break;
      case 'statusLabel':
        updates.statusLabel = String(parsed.data.newValue);
        break;
      case 'fit':
        updates.fit = Number(parsed.data.newValue);
        break;
      case 'award':
        updates.award = String(parsed.data.newValue);
        break;
      case 'deadline':
        updates.deadline = String(parsed.data.newValue);
        break;
      case 'title':
        updates.title = String(parsed.data.newValue);
        break;
      case 'funder':
        updates.funder = String(parsed.data.newValue);
        break;
      case 'funderShort':
        updates.funderShort = String(parsed.data.newValue);
        break;
      case 'category':
        updates.category = String(parsed.data.newValue);
        break;
      default:
        break;
    }
    await deps.repository.updateGrant(grantId, updates);

    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'human_override',
      entityId: grantId,
      entityType: 'grant',
      actorLabel: 'operator',
      timestamp: override.overriddenAt,
      metadata: { field: parsed.data.field, previousValue: override.previousValue, newValue: parsed.data.newValue, rationale: parsed.data.rationale, overrideType: parsed.data.overrideType },
    });

    return NextResponse.json(await deps.repository.getGrant(grantId));
  } catch (error) {
    console.error('Error overriding grant:', error);
    return NextResponse.json({ error: 'Failed to override grant' }, { status: 500 });
  }
}
