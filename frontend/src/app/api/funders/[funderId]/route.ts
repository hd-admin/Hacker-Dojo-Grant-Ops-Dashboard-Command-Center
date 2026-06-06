import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import type { FunderProfile } from '../../../../../../shared/types';

export const dynamic = 'force-dynamic';

const funderUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['foundation', 'government', 'corporate', 'community', 'other']).optional(),
  ein: z.string().optional(),
  focusAreas: z.array(z.string()).optional(),
  geographicFocus: z.array(z.string()).optional(),
  typicalAwardRange: z.object({ min: z.number(), max: z.number() }).optional(),
  applicationProcess: z.string().optional(),
  deadlines: z.string().optional(),
  sourceUrls: z.array(z.string()).optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ funderId: string }> },
): Promise<NextResponse> {
  await connection();
  try {
    const { funderId } = await context.params;
    const { loadFunderProfiles } = await import('../../../../../../shared/grant-ops-persistence');
    const funders = await loadFunderProfiles();
    const funder = funders.find((f: FunderProfile) => f.id === funderId);
    if (!funder) {
      return NextResponse.json(
        createErrorResponse('FILE_NOT_FOUND', `Funder '${funderId}' not found`),
        { status: 404 },
      );
    }
    return NextResponse.json(funder);
  } catch (error) {
    logger.error({ err: error }, 'Error getting funder');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get funder'), {
      status: 500,
    });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ funderId: string }> },
): Promise<NextResponse> {
  await connection();
  try {
    const { funderId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = funderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid funder payload', {
          validationErrors: parsed.error.format(),
        }),
        { status: 400 },
      );
    }
    const { loadFunderProfiles, saveFunderProfiles } =
      await import('../../../../../../shared/grant-ops-persistence');
    const funders = await loadFunderProfiles();
    const index = funders.findIndex((f: FunderProfile) => f.id === funderId);
    if (index === -1) {
      return NextResponse.json(
        createErrorResponse('FILE_NOT_FOUND', `Funder '${funderId}' not found`),
        { status: 404 },
      );
    }
    const current = funders[index] as FunderProfile;
    const patch = parsed.data;
    const updated: FunderProfile = {
      id: current.id,
      name: patch.name ?? current.name,
      type: patch.type ?? current.type,
      focusAreas: patch.focusAreas ?? current.focusAreas,
      geographicFocus: patch.geographicFocus ?? current.geographicFocus,
      typicalAwardRange: patch.typicalAwardRange ?? current.typicalAwardRange,
      applicationProcess: patch.applicationProcess ?? current.applicationProcess,
      deadlines: patch.deadlines ?? current.deadlines,
      sourceUrls: patch.sourceUrls ?? current.sourceUrls,
      givingHistory: current.givingHistory,
      lastUpdated: new Date().toISOString(),
    };
    if (patch.ein !== undefined) {
      updated.ein = patch.ein;
    } else if (current.ein !== undefined) {
      updated.ein = current.ein;
    }
    funders[index] = updated;
    await saveFunderProfiles(funders);
    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'Error updating funder');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to update funder'),
      { status: 500 },
    );
  }
}
