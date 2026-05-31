import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

const expenseSchema = z.object({
  categoryId: z.string().optional(),
  description: z.string().default(''),
  amount: z.number().default(0),
  date: z.string().default(''),
  isPlanned: z.number().default(0),
  receiptPath: z.string().default(''),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ awardId: string }> }) {
  await connection();
  try {
    const { awardId } = await params;
    const deps = getDependencies();
    const expenses = await deps.repository.getExpensesByAwardId?.(awardId) ?? [];
    return NextResponse.json({ expenses });
  } catch (error) {
    logger.error({ err: error }, 'Error getting expenses');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get expenses'), { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ awardId: string }> }) {
  await connection();
  try {
    const { awardId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid expense payload', details: parsed.error.format() }, { status: 400 });
    }
    const deps = getDependencies();
    const expense = {
      id: deps.idGenerator.generateId('expense'),
      awardId,
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
