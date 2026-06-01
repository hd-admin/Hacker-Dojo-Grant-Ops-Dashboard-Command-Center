/**
 * Award Compliance API Route Tests
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
import { GET, PUT } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/awards/[awardId]/compliance route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns compliance items for an award', async () => {
    const mockItems = [
      { id: 'c1', awardId: 'a1', requirement: 'Annual report', status: 'pending' },
    ];
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { getComplianceItemsByAwardId: vi.fn().mockResolvedValue(mockItems) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = { url: 'http://localhost/api/awards/a1/compliance' } as unknown as NextRequest;
    const response = await GET(req, { params: Promise.resolve({ awardId: 'a1' }) });
    const data = await (response as NextResponse).json();
    expect(data.compliance).toEqual(mockItems);
  });

  it('creates a compliance item', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { createComplianceItem: vi.fn().mockResolvedValue(undefined) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/awards/a1/compliance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirement: 'Audit', dueDate: '2027-01-01' }),
    });
    const response = await PUT(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a1' }),
    });
    expect(response.status).toBe(200);
    const data = await (response as NextResponse).json();
    expect(data.compliance.requirement).toBe('Audit');
  });

  it('returns 400 for invalid compliance data', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: () => 'test' },
    });
    const req = new Request('http://localhost/api/awards/a1/compliance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid-status' }),
    });
    const response = await PUT(req as unknown as NextRequest, {
      params: Promise.resolve({ awardId: 'a1' }),
    });
    expect(response.status).toBe(400);
  });
});
