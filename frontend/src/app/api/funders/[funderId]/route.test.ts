/**
 * Funders [funderId] API Route Tests
 *
 * Tests the /api/funders/[funderId] endpoint for GET and PUT.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../../shared/grant-ops-persistence', () => ({
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

import { GET, PUT } from './route';
import type { NextRequest, NextResponse } from 'next/server';

function makeParams(funderId: string) {
  return { params: Promise.resolve({ funderId }) };
}

describe('/api/funders/[funderId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    it('returns a funder by id', async () => {
      const { loadFunderProfiles } = await import('../../../../../../shared/grant-ops-persistence');
      const mockFunder = {
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
      };
      (loadFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([mockFunder]);

      const req = new Request('http://localhost:3000/api/funders/funder-1');
      const response = await GET(req as unknown as NextRequest, makeParams('funder-1'));
      const data = await (response as NextResponse).json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('funder-1');
      expect(data.name).toBe('Test Foundation');
    });

    it('returns 404 when funder not found', async () => {
      const { loadFunderProfiles } = await import('../../../../../../shared/grant-ops-persistence');
      (loadFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const req = new Request('http://localhost:3000/api/funders/nonexistent');
      const response = await GET(req as unknown as NextRequest, makeParams('nonexistent'));
      const data = await (response as NextResponse).json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('PUT', () => {
    it('updates a funder with valid data', async () => {
      const { loadFunderProfiles, saveFunderProfiles } =
        await import('../../../../../../shared/grant-ops-persistence');
      const mockFunder = {
        id: 'funder-1',
        name: 'Original Name',
        type: 'foundation' as const,
        focusAreas: ['education'],
        geographicFocus: ['US'],
        typicalAwardRange: { min: 10000, max: 100000 },
        applicationProcess: 'Online',
        deadlines: 'Rolling',
        sourceUrls: ['https://example.com'],
        givingHistory: [],
        lastUpdated: '2026-01-01T00:00:00Z',
      };
      (loadFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([mockFunder]);
      (saveFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { NextRequest } = await import('next/server');
      const req = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/funders/funder-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name', type: 'government' }),
      });
      const response = await PUT(req as unknown as NextRequest, makeParams('funder-1'));
      const data = await (response as NextResponse).json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('Updated Name');
      expect(data.type).toBe('government');
    });

    it('returns 404 when updating nonexistent funder', async () => {
      const { loadFunderProfiles } = await import('../../../../../../shared/grant-ops-persistence');
      (loadFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { NextRequest } = await import('next/server');
      const req = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/funders/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'New Name' }),
      });
      const response = await PUT(req as unknown as NextRequest, makeParams('nonexistent'));
      const data = await (response as NextResponse).json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('FILE_NOT_FOUND');
    });

    it('returns 400 for invalid funder payload', async () => {
      const { loadFunderProfiles } = await import('../../../../../../shared/grant-ops-persistence');
      const mockFunder = {
        id: 'funder-1',
        name: 'Test',
        type: 'foundation' as const,
        focusAreas: ['education'],
        geographicFocus: ['US'],
        typicalAwardRange: { min: 10000, max: 100000 },
        applicationProcess: 'Online',
        deadlines: 'Rolling',
        sourceUrls: ['https://example.com'],
        givingHistory: [],
        lastUpdated: '2026-01-01T00:00:00Z',
      };
      (loadFunderProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([mockFunder]);

      const { NextRequest } = await import('next/server');
      const req = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/funders/funder-1', {
        method: 'PUT',
        body: JSON.stringify({ type: 'invalid-type' }),
      });
      const response = await PUT(req as unknown as NextRequest, makeParams('funder-1'));
      const data = await (response as NextResponse).json();

      expect(response.status).toBe(400);
      expect(data.error).toBeTruthy();
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });
});
