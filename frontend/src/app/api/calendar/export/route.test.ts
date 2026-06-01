/**
 * Calendar Export API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/server/grant-ops/dependencies', () => ({
  getDependencies: vi.fn(),
  setDependencies: vi.fn(),
  resetDependencies: vi.fn(),
  createDependencies: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  default: {
    join: vi.fn((...args: string[]) => args.join('/')),
  },
  join: vi.fn((...args: string[]) => args.join('/')),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    connection: async () => {},
    NextRequest: class {
      url: string;
      constructor(url = 'http://localhost:3000/api/calendar/export') {
        this.url = url;
      }
    },
    NextResponse: actual.NextResponse,
  };
});

import { getDependencies } from '@/server/grant-ops/dependencies';
import { GET } from './route';

describe('/api/calendar/export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports iCal with grant deadlines', async () => {
    const mockGrants = [
      {
        id: 'g1',
        title: 'Grant A',
        funder: 'F1',
        deadline: '2026-12-31',
        daysOut: 200,
        fit: 80,
        status: 'matched',
        statusLabel: 'Matched',
        matchedAt: '2026-01-01',
        award: '$50k',
        awardSort: 50000,
        tags: [],
        funderShort: 'F',
      },
    ];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {
        getGrants: vi.fn().mockResolvedValue(mockGrants),
        getAwards: vi.fn().mockResolvedValue([]),
      },
    });

    const { NextRequest } = await import('next/server');
    const mockReq = new (NextRequest as unknown as new (url: string) => Request)(
      'http://localhost:3000/api/calendar/export?scope=grants',
    );
    const response = await GET(mockReq as unknown as NextRequest);

    expect(response.status).toBe(200);
    const headers = (response as Response).headers;
    expect(headers.get('Content-Type')).toBe('text/calendar');
  });

  it('exports iCal with report deadlines when scope includes reports', async () => {
    const mockGrants: Array<Record<string, unknown>> = [];
    const mockAwards = [{ id: 'a1', title: 'Award X', funder: 'F5' }];
    const mockReports = [{ id: 'r1', reportType: 'Final', dueDate: '2027-06-30' }];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {
        getGrants: vi.fn().mockResolvedValue(mockGrants),
        getAwards: vi.fn().mockResolvedValue(mockAwards),
        getReportDeadlinesByAwardId: vi.fn().mockResolvedValue(mockReports),
      },
    });

    const { NextRequest } = await import('next/server');
    const mockReq = new (NextRequest as unknown as new (url: string) => Request)(
      'http://localhost:3000/api/calendar/export?scope=reports',
    );
    const response = await GET(mockReq as unknown as NextRequest);

    expect(response.status).toBe(200);
    const headers = (response as Response).headers;
    expect(headers.get('Content-Type')).toBe('text/calendar');
  });

  it('exports empty calendar when no deadlines', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {
        getGrants: vi.fn().mockResolvedValue([]),
        getAwards: vi.fn().mockResolvedValue([]),
      },
    });

    const { NextRequest } = await import('next/server');
    const mockReq = new (NextRequest as unknown as new (url: string) => Request)(
      'http://localhost:3000/api/calendar/export',
    );
    const response = await GET(mockReq as unknown as NextRequest);

    expect(response.status).toBe(200);
    const headers = (response as Response).headers;
    expect(headers.get('Content-Type')).toBe('text/calendar');
  });
});
