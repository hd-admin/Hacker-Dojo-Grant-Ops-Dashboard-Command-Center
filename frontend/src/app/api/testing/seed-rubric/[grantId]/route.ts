import { NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { revalidateAfterMutation } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const fitRubricSchema = z.object({
  rubricVersion: z.number().int().min(1),
  missionAlignment: z.object({ score: z.number().min(0).max(1), justification: z.string() }),
  geographicFocus: z.object({ score: z.number().min(0).max(1), justification: z.string() }),
  programTrackrecord: z.object({ score: z.number().min(0).max(1), justification: z.string() }),
  budgetCapacity: z.object({ score: z.number().min(0).max(1), justification: z.string() }),
  partnershipReadiness: z.object({ score: z.number().min(0).max(1), justification: z.string() }),
  overallRationale: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ grantId: string }> },
): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Not found'), { status: 404 });
  }
  try {
    await connection();
    const { grantId } = await params;
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = fitRubricSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid rubric payload'),
        { status: 400 },
      );
    }
    const deps = getDependencies();
    const existing = await deps.repository.getGrant(grantId);
    if (!existing) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Grant not found'), {
        status: 404,
      });
    }
    await deps.repository.updateGrant(grantId, {
      fitRubric: parsed.data,
      lastSeenAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    });
    revalidateAfterMutation();
    return NextResponse.json({ success: true, grantId, fitRubric: parsed.data });
  } catch (error) {
    logger.error({ err: error }, 'Error seeding rubric');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to seed rubric'),
      { status: 500 },
    );
  }
}
