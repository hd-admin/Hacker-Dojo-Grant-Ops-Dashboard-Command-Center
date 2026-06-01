/**
 * Reports Forecast API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/grant-ops/repository', () => ({
  getGrants: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/server/grant-ops/dashboard-service', () => ({
  generateFundraisingForecast: vi.fn().mockReturnValue({
    projectedSubmissions90d: 5,
    projectedAwardValue: 250000,
    atRiskGrants: [],
  }),
}));
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import { getGrants } from '@/server/grant-ops/repository';
import { GET } from './route';
import type { NextResponse } from 'next/server';

describe('/api/reports/forecast route', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns fundraising forecast data', async () => {
    (getGrants as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const response = await GET();
    const data = await (response as NextResponse).json();
    expect(data.projectedSubmissions90d).toBe(5);
    expect(data.projectedAwardValue).toBe(250000);
    expect(data.atRiskGrantCount).toBe(0);
  });
});
