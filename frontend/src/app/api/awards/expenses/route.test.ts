/**
 * Awards Expenses (list) API Route Tests
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

describe('/api/awards/expenses route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns expenses filtered by awardId', async () => {
    const mockExpenses = [{ id: 'e1', awardId: 'a1', description: 'Item', amount: 500 }];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getExpensesByAwardId: vi.fn().mockResolvedValue(mockExpenses) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/expenses?awardId=a1');
    const response = await GET(req as unknown as NextRequest);
    const data = await (response as NextResponse).json();
    expect(data.expenses).toEqual(mockExpenses);
  });

  it('returns 400 when awardId param is missing', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({ repository: {} });
    const req = new Request('http://localhost/api/awards/expenses');
    const response = await GET(req as unknown as NextRequest);
    expect(response.status).toBe(400);
  });

  it('creates an expense', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { createExpense: vi.fn().mockResolvedValue(undefined) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awardId: 'a1', description: 'Item', amount: 100 }),
    });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(201);
  });

  it('returns 400 for invalid expense payload', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: () => 'test' },
    });
    const req = new Request('http://localhost/api/awards/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 'not-a-number' }),
    });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(400);
  });
});
