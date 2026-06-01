/**
 * Calendar Reports API Route Tests
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
  return {
    ...actual,
    connection: async () => {},
    NextRequest: class { url = 'http://localhost:3000/api/calendar/reports'; },
  };
});

import { getDependencies } from '@/server/grant-ops/dependencies';
import { GET } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/calendar/reports route', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns report deadlines for awards', async () => {
    const mockAwards = [
      { id: 'a1', title: 'Award 1', funder: 'F1' },
      { id: 'a2', title: 'Award 2', funder: 'F2' },
    ];
    const mockReportsA1 = [
      { id: 'r1', reportType: 'Interim', dueDate: '2026-09-01', status: 'pending' },
    ];
    const mockReportsA2 = [
      { id: 'r2', reportType: 'Final', dueDate: '2027-01-15', status: 'pending' },
      { id: 'r3', reportType: 'Financial', dueDate: '2027-02-01', status: 'pending' },
    ];
    const mockRepo = {
      getAwards: vi.fn().mockResolvedValue(mockAwards),
      getReportDeadlinesByAwardId: vi.fn().mockImplementation(async (awardId: string) => {
        if (awardId === 'a1') return mockReportsA1;
        if (awardId === 'a2') return mockReportsA2;
        return [];
      }),
    };
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({ repository: mockRepo });

    const { NextRequest } = await import('next/server');
    const mockReq = new (NextRequest as unknown as new () => Request)();
    const response = await GET(mockReq as unknown as NextRequest);
    const data = await (response as NextResponse).json();

    expect(data.reports.length).toBe(3);
    const awardTitles = data.reports.map((r: { awardTitle: string }) => r.awardTitle);
    expect(awardTitles).toContain('Award 1');
    expect(awardTitles).toContain('Award 2');
  });

  it('returns empty reports when no awards', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getAwards: vi.fn().mockResolvedValue([]), getReportDeadlinesByAwardId: vi.fn() },
    });

    const { NextRequest } = await import('next/server');
    const mockReq = new (NextRequest as unknown as new () => Request)();
    const response = await GET(mockReq as unknown as NextRequest);
    const data = await (response as NextResponse).json();
    expect(data.reports).toEqual([]);
  });
});
