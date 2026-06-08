import { type NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

const plannedExpenseSchema = z.object({
  categoryId: z.string().min(1, 'categoryId is required'),
  description: z.string().default(''),
  amount: z.number().positive('amount must be positive'),
  date: z.string().default(''),
  notes: z.string().default(''),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ awardId: string }> },
): Promise<NextResponse> {
  await connection();
  try {
    const { awardId } = await params;
    const deps = getDependencies();
    const records = (await deps.repository.getPlannedExpensesByAwardId(awardId)) ?? [];
    return NextResponse.json({ plannedExpenses: records });
  } catch (error) {
    logger.error({ err: error }, 'Error getting planned expenses');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get planned expenses'),
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ awardId: string }> },
): Promise<NextResponse> {
  await connection();
  try {
    const { awardId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = plannedExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid planned expense payload', {
          validationErrors: parsed.error.format(),
        }),
        { status: 400 },
      );
    }

    const deps = getDependencies();
    const record = {
      id: deps.idGenerator.generateId('planned-expense'),
      awardId,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    await deps.repository.addPlannedExpense?.(record);
    return NextResponse.json({ plannedExpense: record }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error creating planned expense');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create planned expense'),
      { status: 500 },
    );
  }
}
