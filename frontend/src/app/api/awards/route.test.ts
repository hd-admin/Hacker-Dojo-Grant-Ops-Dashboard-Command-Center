/**
 * Awards API Route Tests
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
    NextRequest: class {
      url = 'http://localhost:3000/api/awards';
      method = 'GET';
      body_: string | null = null;
      json() {
        if (this.body_ === null) throw new Error('no body');
        return Promise.resolve(JSON.parse(this.body_));
      }
    },
  };
});

import { getDependencies } from '@/server/grant-ops/dependencies';
import { GET, POST } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/awards route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns awards list', async () => {
    const mockAwards = [
      { id: 'a1', grantId: 'g1', funder: 'F1', title: 'Award 1', amount: 50000, status: 'active' },
    ];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getAwards: vi.fn().mockResolvedValue(mockAwards) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });

    const req = new Request('http://localhost:3000/api/awards');
    const response = await GET(req as unknown as NextRequest);
    const data = await (response as NextResponse).json();
    expect(data.awards).toEqual(mockAwards);
  });

  it('returns empty awards when none exist', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getAwards: vi.fn().mockResolvedValue([]) },
      idGenerator: { generateId: () => 'test' },
    });
    const req = new Request('http://localhost:3000/api/awards');
    const response = await GET(req as unknown as NextRequest);
    const data = await (response as NextResponse).json();
    expect(data.awards).toEqual([]);
  });

  it('creates an award with valid data', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { createAward: vi.fn().mockResolvedValue(undefined) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const { NextRequest } = await import('next/server');
    const req = new (NextRequest as unknown as new () => Request)();
    (req as unknown as { body_: string | null }).body_ = JSON.stringify({
      grantId: 'g1',
      funder: 'F1',
      title: 'New Award',
    });
    (req as unknown as { method: string }).method = 'POST';
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(201);
  });

  it('returns 400 for invalid award payload', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: () => 'test' },
    });
    const { NextRequest } = await import('next/server');
    const req = new (NextRequest as unknown as new () => Request)();
    (req as unknown as { body_: string | null }).body_ = JSON.stringify({});
    (req as unknown as { method: string }).method = 'POST';
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(400);
  });
});
