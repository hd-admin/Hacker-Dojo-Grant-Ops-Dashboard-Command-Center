/**
 * Reports Annual Summary API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/grant-ops/repository', () => ({
  getGrants: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/server/grant-ops/dashboard-service', () => ({
  generateAnnualSummary: vi.fn().mockReturnValue({
    totalGrants: 10,
    totalAwardValue: 500000,
    statusBreakdown: { matched: 5, submitted: 3, awarded: 2 },
  }),
}));
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import { getGrants } from '@/server/grant-ops/repository';
import { GET } from './route';
import type { NextResponse } from 'next/server';

describe('/api/reports/annual-summary route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns annual summary data', async () => {
    (getGrants as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const response = await GET();
    const data = await (response as NextResponse).json();
    expect(data.totalGrants).toBe(10);
    expect(data.totalAwardValue).toBe(500000);
  });
});
