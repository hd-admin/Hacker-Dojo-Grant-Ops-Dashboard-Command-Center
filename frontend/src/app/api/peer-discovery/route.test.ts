/**
 * Peer Discovery API Route Tests
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

describe('/api/peer-discovery route', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('queues peer discovery job', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
    const req = new Request('http://localhost/api/peer-discovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(202);
    const data = await (response as NextResponse).json();
    expect(data.jobId).toBeDefined();
  });

  it('queues with sourceUrl', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      idGenerator: { generateId: () => 'peer-test' },
    });
    const req = new Request('http://localhost/api/peer-discovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceUrl: 'https://example.com' }) });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(202);
  });
});
