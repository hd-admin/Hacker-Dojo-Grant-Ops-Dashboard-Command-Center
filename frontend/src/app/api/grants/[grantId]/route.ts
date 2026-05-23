import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Grant } from '../../../../../../shared/types';
import { loadGrantDetail } from '@/server/grant-ops/grant-detail';
import { getDependencies } from '@/server/grant-ops/dependencies';
export const dynamic = 'force-dynamic';

const checklistItemSchema = z.object({
  label: z.string(),
  done: z.boolean(),
  source: z.string(),
});

const fitBreakdownSchema = z.object({
  missionAlignment: z.number(),
  geographicFocus: z.number(),
  programTrackrecord: z.number(),
  budgetCapacity: z.number(),
  partnershipReadiness: z.number(),
});

const grantPatchSchema = z
  .object({
    title: z.string().optional(),
    funder: z.string().optional(),
    funderShort: z.string().optional(),
    award: z.string().optional(),
    awardSort: z.number().optional(),
    deadline: z.string().optional(),
    daysOut: z.number().int().optional(),
    fit: z.number().int().optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['matched', 'draft', 'review', 'submitted', 'awarded']).optional(),
    statusLabel: z.string().optional(),
    matchedAt: z.string().optional(),
    fitBreakdown: fitBreakdownSchema.optional(),
    checklist: z.array(checklistItemSchema).optional(),
    draftContent: z.string().optional(),
    externalUrl: z.string().optional(),
    funderSummary: z.string().optional(),
    latestDraftVersion: z.number().int().min(0).optional(),
    groundedDocumentCount: z.number().int().min(0).optional(),
    sourceCount: z.number().int().min(0).optional(),
  })
  .strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const detail = await loadGrantDetail(grantId);

    if (!detail) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('Error getting grant detail:', error);
    return NextResponse.json({ error: 'Failed to get grant' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ grantId: string }> },
) {
  try {
    const { grantId } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const parsed = grantPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid grant detail payload', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const deps = getDependencies();
    const existingGrant = await deps.repository.getGrant(grantId);
    if (!existingGrant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    const updates = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined),
    ) as Partial<Grant>;

    await deps.repository.updateGrant(grantId, updates);

    const updatedDetail = await loadGrantDetail(grantId);
    if (!updatedDetail) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    return NextResponse.json(updatedDetail);
  } catch (error) {
    console.error('Error updating grant detail:', error);
    return NextResponse.json({ error: 'Failed to update grant' }, { status: 500 });
  }
}
