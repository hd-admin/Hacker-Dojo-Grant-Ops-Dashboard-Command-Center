/**
 * Spenddown Alerts API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/grant-ops/dependencies', () => ({
  getDependencies: vi.fn(),
  setDependencies: vi.fn(), resetDependencies: vi.fn(), createDependencies: vi.fn(),
}));
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import { getDependencies } from '@/server/grant-ops/dependencies';
import { GET } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/awards/spenddown-alerts route', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns alerts for overspent categories', async () => {
    const mockCategories = [{ category: 'Staff', budgeted: 10000, spent: 12000 }];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {
        getAwards: vi.fn().mockResolvedValue([{ id: 'a1' }]),
        getBudgetCategoriesByAwardId: vi.fn().mockResolvedValue(mockCategories),
      },
    });
    const req = new Request('http://localhost/api/awards/spenddown-alerts');
    const response = await GET(req as unknown as NextRequest);
    const data = await (response as NextResponse).json();
    expect(data.alerts.length).toBe(1);
    expect(data.alerts[0].type).toBe('over');
  });

  it('returns alerts for underspent categories', async () => {
    const mockCategories = [{ category: 'Equipment', budgeted: 10000, spent: 500 }];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {
        getAwards: vi.fn().mockResolvedValue([{ id: 'a1' }]),
        getBudgetCategoriesByAwardId: vi.fn().mockResolvedValue(mockCategories),
      },
    });
    const req = new Request('http://localhost/api/awards/spenddown-alerts');
    const response = await GET(req as unknown as NextRequest);
    const data = await (response as NextResponse).json();
    expect(data.alerts.length).toBe(1);
    expect(data.alerts[0].type).toBe('under');
  });

  it('returns empty alerts when no awards', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getAwards: vi.fn().mockResolvedValue([]) },
    });
    const req = new Request('http://localhost/api/awards/spenddown-alerts');
    const response = await GET(req as unknown as NextRequest);
    const data = await (response as NextResponse).json();
    expect(data.alerts).toEqual([]);
  });
});
