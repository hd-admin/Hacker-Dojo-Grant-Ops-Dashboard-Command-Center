/**
 * Funders API Route Tests
 *
 * Tests the /api/funders endpoint for listing and creating funders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../shared/grant-ops-persistence', () => ({
  loadFunderProfiles: vi.fn(() => Promise.resolve([])),
  saveFunderProfiles: vi.fn(() => Promise.resolve()),
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

import { GET, POST } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/funders route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    it('returns all funders', async () => {
      const { loadFunderProfiles } = await import('../../../../../shared/grant-ops-persistence');
      const mockFunders = [
        {
          id: 'funder-1',
          name: 'Test Foundation',
          type: 'foundation' as const,
          focusAreas: ['education'],
          geographicFocus: ['US'],
          typicalAwardRange: { min: 10000, max: 100000 },
          applicationProcess: 'Online',
          deadlines: 'Rolling',
          sourceUrls: ['https://example.com'],
          givingHistory: [],
          lastUpdated: '2026-01-01T00:00:00Z',
        },
      ];
      (loadFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue(mockFunders);

      const req = new Request('http://localhost:3000/api/funders');
      const response = await GET(req as unknown as NextRequest);
      const data = await (response as NextResponse).json();

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].name).toBe('Test Foundation');
    });

    it('returns empty array when no funders exist', async () => {
      const { loadFunderProfiles } = await import('../../../../../shared/grant-ops-persistence');
      (loadFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const req = new Request('http://localhost:3000/api/funders');
      const response = await GET(req as unknown as NextRequest);
      const data = await (response as NextResponse).json();

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe('POST', () => {
    it('creates a funder with valid data', async () => {
      const { loadFunderProfiles, saveFunderProfiles } =
        await import('../../../../../shared/grant-ops-persistence');
      (loadFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (saveFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { NextRequest } = await import('next/server');
      const req = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/funders', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Foundation',
          type: 'foundation',
          focusAreas: ['health'],
        }),
      });
      const response = await POST(req as unknown as NextRequest);
      const data = await (response as NextResponse).json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('New Foundation');
      expect(data.type).toBe('foundation');
    });

    it('returns 400 for invalid funder payload', async () => {
      const { loadFunderProfiles } = await import('../../../../../shared/grant-ops-persistence');
      (loadFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { NextRequest } = await import('next/server');
      const req = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/funders', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(req as unknown as NextRequest);
      const data = await (response as NextResponse).json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing funder name', async () => {
      const { loadFunderProfiles } = await import('../../../../../shared/grant-ops-persistence');
      (loadFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { NextRequest } = await import('next/server');
      const req = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/funders', {
        method: 'POST',
        body: JSON.stringify({ type: 'foundation' }),
      });
      const response = await POST(req as unknown as NextRequest);
      const data = await (response as NextResponse).json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });
});
