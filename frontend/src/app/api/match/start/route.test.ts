/**
 * Match Start API Route Tests
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
import { POST } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/match/start route', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('queues a match scoring job', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/match/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grantIds: ['g1', 'g2'] }) });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(202);
    const data = await (response as NextResponse).json();
    expect(data.jobId).toBeDefined();
    expect(data.grantIds).toEqual(['g1', 'g2']);
  });

  it('returns 202 with empty grantIds when none provided', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/match/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(202);
  });

  it('returns 400 for invalid body', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({ idGenerator: { generateId: () => 'test' } });
    const req = new Request('http://localhost/api/match/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grantIds: 'not-an-array' }) });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(400);
  });
});
