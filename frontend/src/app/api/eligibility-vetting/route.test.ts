/**
 * Eligibility Vetting API Route Tests
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
import { POST } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/eligibility-vetting route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queues an eligibility vetting job', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/eligibility-vetting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(202);
  });

  it('queues with grantId', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      idGenerator: { generateId: () => 'ev-test' },
    });
    const req = new Request('http://localhost/api/eligibility-vetting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grantId: 'g1' }),
    });
    const response = await POST(req as unknown as NextRequest);
    const data = await (response as NextResponse).json();
    expect(data.grantId).toBe('g1');
  });
});
