/**
 * Award Reports API Route Tests (per award)
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

describe('/api/awards/[awardId]/reports route', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns report deadlines for an award', async () => {
    const mockReports = [{ id: 'r1', awardId: 'a1', reportType: 'Interim', dueDate: '2026-09-01', status: 'pending' }];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getReportDeadlinesByAwardId: vi.fn().mockResolvedValue(mockReports) },
    });
    const req = { url: 'http://localhost/api/awards/a1/reports' } as unknown as NextRequest;
    const response = await GET(req as unknown as NextRequest, { params: Promise.resolve({ awardId: 'a1' }) });
    const data = await (response as NextResponse).json();
    expect(data.reports).toEqual(mockReports);
  });

  it('returns empty reports when none exist', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getReportDeadlinesByAwardId: vi.fn().mockResolvedValue([]) },
    });
    const req = { url: 'http://localhost/api/awards/a1/reports' } as unknown as NextRequest;
    const response = await GET(req as unknown as NextRequest, { params: Promise.resolve({ awardId: 'a1' }) });
    const data = await (response as NextResponse).json();
    expect(data.reports).toEqual([]);
  });
});
