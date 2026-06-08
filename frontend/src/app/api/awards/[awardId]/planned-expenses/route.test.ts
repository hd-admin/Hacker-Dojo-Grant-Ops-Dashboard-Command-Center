/**
 * Planned Expenses API Route Tests (per award)
 *
 * Pattern-mirrors the existing
 * frontend/src/app/api/awards/[awardId]/expenses/route.test.ts
 * with the planned-expense schema (categoryId required, amount
 * must be positive).
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

describe('/api/awards/[awardId]/planned-expenses route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET returns planned expenses for an award', async () => {
    const mockPlanned = [
      { id: 'p1', awardId: 'a1', categoryId: 'cat-1', description: 'Q3 conference', amount: 1500 },
    ];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getPlannedExpensesByAwardId: vi.fn().mockResolvedValue(mockPlanned) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/a1/planned-expenses');
    const response = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a1' }),
    });
    const data = await (response as NextResponse).json();
    expect(data.plannedExpenses).toEqual(mockPlanned);
  });

  it('GET filters by awardId and returns empty array if none match', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getPlannedExpensesByAwardId: vi.fn().mockResolvedValue([]) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/a-unknown/planned-expenses');
    const response = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a-unknown' }),
    });
    const data = await (response as NextResponse).json();
    expect(data.plannedExpenses).toEqual([]);
  });

  it('POST validates the schema and returns 400 when categoryId is missing', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/a1/planned-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, date: '2026-12-01' }),
    });
    const response = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a1' }),
    });
    expect(response.status).toBe(400);
    const data = await (response as NextResponse).json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('POST validates the schema and returns 400 when amount is missing', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/a1/planned-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: 'cat-1', date: '2026-12-01' }),
    });
    const response = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a1' }),
    });
    expect(response.status).toBe(400);
  });

  it('POST creates a planned expense and returns 201', async () => {
    const addPlannedExpense = vi.fn().mockResolvedValue(undefined);
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { addPlannedExpense },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/a1/planned-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: 'cat-1',
        amount: 1500,
        date: '2026-12-01',
        description: 'Q3 conference',
      }),
    });
    const response = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a1' }),
    });
    expect(response.status).toBe(201);
    const data = await (response as NextResponse).json();
    expect(data.plannedExpense).toMatchObject({
      awardId: 'a1',
      categoryId: 'cat-1',
      amount: 1500,
    });
    expect(addPlannedExpense).toHaveBeenCalledTimes(1);
  });

  it('POST rejects non-positive amounts', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/a1/planned-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: 'cat-1', amount: 0 }),
    });
    const response = await POST(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a1' }),
    });
    expect(response.status).toBe(400);
  });
});
