import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

const expenseSchema = z.object({
  awardId: z.string(),
  categoryId: z.string().optional(),
  description: z.string().default(''),
  amount: z.number().default(0),
  date: z.string().default(''),
  isPlanned: z.number().default(0),
  receiptPath: z.string().default(''),
});

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const awardId = searchParams.get('awardId');
    if (!awardId) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'awardId is required'), { status: 400 });
    }
    const deps = getDependencies();
    const expenses = await deps.repository.getExpensesByAwardId?.(awardId) ?? [];
    return NextResponse.json({ expenses });
  } catch (error) {
    logger.error({ err: error }, 'Error getting expenses');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get expenses'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid expense payload', details: parsed.error.format() }, { status: 400 });
    }
    const deps = getDependencies();
    const expense = {
      id: deps.idGenerator.generateId('expense'),
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    await deps.repository.createExpense?.(expense);
    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error creating expense');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create expense'), { status: 500 });
  }
}
