/**
 * Award Expenses API Route Tests (per award)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/grant-ops/dependencies', () => ({
  getDependencies: vi.fn(),
  setDependencies: vi.fn(),
  resetDependencies: vi.fn(),
  createDependencies: vi.fn(),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import { getDependencies } from '@/server/grant-ops/dependencies';
import { GET, POST } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/awards/[awardId]/expenses route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns expenses for an award', async () => {
    const mockExpenses = [{ id: 'e1', awardId: 'a1', description: 'Equipment', amount: 1000 }];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getExpensesByAwardId: vi.fn().mockResolvedValue(mockExpenses) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/a1/expenses');
    const response = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a1' }),
    });
    const data = await (response as NextResponse).json();
    expect(data.expenses).toEqual(mockExpenses);
  });

  it('creates an expense', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { createExpense: vi.fn().mockResolvedValue(undefined) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/a1/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Item', amount: 500 }),
    });
    const response = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a1' }),
    });
    expect(response.status).toBe(201);
  });

  it('returns 400 for invalid expense data', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/a1/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 'not-a-number' }),
    });
    const response = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a1' }),
    });
    expect(response.status).toBe(400);
  });
});
