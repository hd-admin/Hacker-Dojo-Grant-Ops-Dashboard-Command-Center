/**
 * Outreach API Route Tests
 *
 * Tests the /api/outreach GET and POST routes.
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
      url: string;
      method: string;
      private body_: string | null;
      constructor(url: string, init?: { method?: string; body?: string }) {
        this.url = url;
        this.method = init?.method || 'GET';
        this.body_ = init?.body ?? null;
      }
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

describe('/api/outreach route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockRepo = {
      getOutreachRecords: vi.fn().mockResolvedValue([]),
      createOutreachRecord: vi.fn().mockResolvedValue(undefined),
    };
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: mockRepo,
      idGenerator: { generateId: (prefix: string) => `${prefix}-test-${Date.now()}` },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    it('returns outreach records', async () => {
      const mockRecords = [
        { id: 'out-1', grantId: 'g1', contactName: 'Alice', contactEmail: 'a@b.com', method: 'email', notes: '', outcome: '', followUpDate: '', createdAt: '2026-01-01' },
      ];
      const deps = getDependencies();
      (deps.repository.getOutreachRecords as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecords);

      const mockReq = { url: 'http://localhost:3000/api/outreach' } as unknown as NextRequest;
      const response = await GET(mockReq);
      const data = await (response as NextResponse).json();
      expect(data.outreach).toEqual(mockRecords);
    });

    it('filters outreach by grantId', async () => {
      const mockRecords = [
        { id: 'out-1', grantId: 'g1', contactName: 'Alice', contactEmail: 'a@b.com', method: 'email', notes: '', outcome: '', followUpDate: '', createdAt: '2026-01-01' },
        { id: 'out-2', grantId: 'g2', contactName: 'Bob', contactEmail: 'b@c.com', method: 'phone', notes: '', outcome: '', followUpDate: '', createdAt: '2026-01-02' },
      ];
      const deps = getDependencies();
      (deps.repository.getOutreachRecords as ReturnType<typeof vi.fn>).mockResolvedValue(mockRecords);

      const mockReq = { url: 'http://localhost:3000/api/outreach?grantId=g1' } as unknown as NextRequest;
      const response = await GET(mockReq);
      const data = await (response as NextResponse).json();
      expect(data.outreach.length).toBe(1);
      expect(data.outreach[0].grantId).toBe('g1');
    });

    it('returns empty array when no records', async () => {
      const mockReq = { url: 'http://localhost:3000/api/outreach' } as unknown as NextRequest;
      const response = await GET(mockReq);
      const data = await (response as NextResponse).json();
      expect(data.outreach).toEqual([]);
    });
  });

  describe('POST', () => {
    it('returns 400 for invalid body', async () => {
      const { NextRequest } = await import('next/server');
      const mockReq = new (NextRequest as unknown as new (url: string, init?: Record<string, unknown>) => Request)(
        'http://localhost:3000/api/outreach',
        { method: 'POST', body: JSON.stringify({}) }
      );
      const response = await POST(mockReq as unknown as NextRequest);
      expect(response.status).toBe(400);
    });

    it('returns 400 for missing grantId', async () => {
      const { NextRequest } = await import('next/server');
      const mockReq = new (NextRequest as unknown as new (url: string, init?: Record<string, unknown>) => Request)(
        'http://localhost:3000/api/outreach',
        { method: 'POST', body: JSON.stringify({ contactName: 'Test' }) }
      );
      const response = await POST(mockReq as unknown as NextRequest);
      expect(response.status).toBe(400);
    });

    it('creates outreach record with valid data', async () => {
      const { NextRequest } = await import('next/server');
      const mockReq = new (NextRequest as unknown as new (url: string, init?: Record<string, unknown>) => Request)(
        'http://localhost:3000/api/outreach',
        { method: 'POST', body: JSON.stringify({ grantId: 'g1', contactName: 'Test', method: 'email' }) }
      );
      const response = await POST(mockReq as unknown as NextRequest);
      const data = await (response as NextResponse).json();
      expect(response.status).toBe(201);
      expect(data.outreach.grantId).toBe('g1');
    });
  });
});
