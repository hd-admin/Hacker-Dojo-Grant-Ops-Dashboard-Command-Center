/**
 * Budget vs Actual API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/grant-ops/award-service', () => ({
  computeBudgetVsActual: vi.fn().mockResolvedValue([]),
}));
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import { computeBudgetVsActual } from '@/server/grant-ops/award-service';
import type { NextResponse } from 'next/server';
import { GET } from './route';

describe('/api/awards/[awardId]/budget-vs-actual route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns budget vs actual rows', async () => {
    const mockRows = [{ category: 'Staff', budgeted: 10000, actual: 8250, variance: 1750 }];
    (computeBudgetVsActual as ReturnType<typeof vi.fn>).mockResolvedValue(mockRows);
    const req = new Request('http://localhost/api/awards/a1/budget-vs-actual');
    const response = await GET(req, { params: Promise.resolve({ awardId: 'a1' }) });
    const data = await (response as NextResponse).json();
    expect(data.rows).toEqual(mockRows);
  });

  it('returns empty rows when no data', async () => {
    (computeBudgetVsActual as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const req = new Request('http://localhost/api/awards/a1/budget-vs-actual');
    const response = await GET(req, { params: Promise.resolve({ awardId: 'a1' }) });
    const data = await (response as NextResponse).json();
    expect(data.rows).toEqual([]);
  });
});
