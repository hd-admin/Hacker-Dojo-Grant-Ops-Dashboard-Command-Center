import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import type { FunderProfile } from '../../../../../shared/types';

export const dynamic = 'force-dynamic';

const funderCreateSchema = z.object({
  name: z.string().min(1, 'Funder name is required'),
  type: z.enum(['foundation', 'government', 'corporate', 'community', 'other']),
  ein: z.string().optional(),
  website: z.string().optional(),
  focusAreas: z.array(z.string()).optional(),
  annualGiving: z.number().optional(),
});

export async function GET(_request: NextRequest) {
  await connection();
  try {
    const { loadFunderProfiles } = await import('../../../../../shared/grant-ops-persistence');
    const funders: FunderProfile[] = await loadFunderProfiles();
    return NextResponse.json(funders);
  } catch (error) {
    logger.error({ err: error }, 'Error listing funders');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to list funders'), {
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    const parsed = funderCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid funder payload', {
          validationErrors: parsed.error.format(),
        }),
        { status: 400 },
      );
    }
    const { loadFunderProfiles, saveFunderProfiles } =
      await import('../../../../../shared/grant-ops-persistence');
    const existing: FunderProfile[] = await loadFunderProfiles();
    const now = new Date().toISOString();
    const newFunder: FunderProfile = {
      id: `funder-${Date.now()}`,
      name: parsed.data.name,
      type: parsed.data.type,
      focusAreas: parsed.data.focusAreas ?? [],
      geographicFocus: [],
      typicalAwardRange: { min: 0, max: 0 },
      applicationProcess: '',
      deadlines: '',
      sourceUrls: parsed.data.website ? [parsed.data.website] : [],
      givingHistory: [],
      lastUpdated: now,
    };
    if (parsed.data.ein !== undefined) {
      newFunder.ein = parsed.data.ein;
    }
    await saveFunderProfiles([...existing, newFunder]);
    return NextResponse.json(newFunder, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error creating funder');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create funder'),
      { status: 500 },
    );
  }
}
