/**
 * Grant History API Route Tests
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
import { GET } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/grants/[grantId]/history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns grant transition history', async () => {
    const mockHistory = [
      {
        id: 't1',
        grantId: 'g1',
        fromState: 'matched',
        toState: 'draft',
        actor: 'operator',
        reason: '',
        createdAt: '2026-01-01',
      },
    ];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getPipelineTransitionsByGrantId: vi.fn().mockResolvedValue(mockHistory) },
    });
    const req = new Request('http://localhost/api/grants/g1/history');
    const response = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ grantId: 'g1' }),
    });
    const data = await (response as NextResponse).json();
    expect(data.grantId).toBe('g1');
    expect(data.history).toEqual(mockHistory);
  });

  it('returns empty history for grant with no transitions', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getPipelineTransitionsByGrantId: vi.fn().mockResolvedValue([]) },
    });
    const req = new Request('http://localhost/api/grants/g2/history');
    const response = await GET(req as unknown as NextRequest, {
      params: Promise.resolve({ grantId: 'g2' }),
    });
    const data = await (response as NextResponse).json();
    expect(data.history).toEqual([]);
  });
});
