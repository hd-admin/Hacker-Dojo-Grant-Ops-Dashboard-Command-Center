/**
 * Discovery Patterns API Route Tests
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
import { GET, POST } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/discovery/patterns route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {
        getAuditEvents: vi.fn().mockResolvedValue([]),
        addAuditEvent: vi.fn().mockResolvedValue(undefined),
      },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns patterns from audit events', async () => {
    const mockEvents = [{ eventType: 'pattern_detected', id: 'e1', entityId: 'e1', entityType: 'pattern', actorLabel: 'agent', timestamp: '2026-01-01', metadata: { id: 'p1', funderName: 'F1', patternType: 'deadline-cycle', confidence: 85, evidence: 'Test' } }];
    const deps = getDependencies();
    (deps.repository.getAuditEvents as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);

    const req = new Request('http://localhost/api/discovery/patterns');
    const response = await GET(req as unknown as NextRequest);
    const data = await (response as NextResponse).json();
    expect(data.patterns.length).toBe(1);
    expect(data.patterns[0].funderName).toBe('F1');
  });

  it('creates a pattern', async () => {
    const req = new Request('http://localhost/api/discovery/patterns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funderName: 'F1', patternType: 'deadline-cycle', confidence: 90, evidence: '3-year pattern' }),
    });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(200);
    const data = await (response as NextResponse).json();
    expect(data.pattern.funderName).toBe('F1');
  });

  it('returns 400 for invalid pattern data', async () => {
    const req = new Request('http://localhost/api/discovery/patterns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(400);
  });
});
