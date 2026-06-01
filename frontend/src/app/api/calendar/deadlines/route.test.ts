/**
 * Calendar Deadlines API Route Tests
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
    NextRequest: class { url = 'http://localhost:3000/api/calendar/deadlines'; },
  };
});

import { getDependencies } from '@/server/grant-ops/dependencies';
import { GET } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/calendar/deadlines route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns deadlines excluding Rolling entries', async () => {
    const mockGrants = [
      { id: 'g1', title: 'Grant 1', funder: 'F1', deadline: '2026-12-31', status: 'matched' },
      { id: 'g2', title: 'Grant 2', funder: 'F2', deadline: 'Rolling', status: 'matched' },
      { id: 'g3', title: 'Grant 3', funder: 'F3', deadline: '', status: 'matched' },
      { id: 'g4', title: 'Grant 4', funder: 'F4', deadline: '2026-06-15', status: 'draft' },
    ];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getGrants: vi.fn().mockResolvedValue(mockGrants) },
    });

    const { NextRequest } = await import('next/server');
    const mockReq = new (NextRequest as unknown as new () => Request)();
    const response = await GET(mockReq as unknown as NextRequest);
    const data = await (response as NextResponse).json();

    expect(data.deadlines.length).toBe(2);
    expect(data.deadlines[0].id).toBe('g1');
    expect(data.deadlines[0].type).toBe('grant');
    expect(data.deadlines[1].id).toBe('g4');
  });

  it('returns empty deadlines when no grants', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getGrants: vi.fn().mockResolvedValue([]) },
    });

    const { NextRequest } = await import('next/server');
    const mockReq = new (NextRequest as unknown as new () => Request)();
    const response = await GET(mockReq as unknown as NextRequest);
    const data = await (response as NextResponse).json();
    expect(data.deadlines).toEqual([]);
  });
});
