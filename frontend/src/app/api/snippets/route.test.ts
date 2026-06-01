/**
 * Snippets API Route Tests
 *
 * Tests the /api/snippets GET, POST, PUT, DELETE routes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/grant-ops/dependencies', () => ({
  getDependencies: vi.fn(),
  setDependencies: vi.fn(),
  resetDependencies: vi.fn(),
  createDependencies: vi.fn(),
}));

vi.mock('../../../../../shared/grant-ops-sqlite', () => ({
  getSqliteState: vi.fn(() => ({})),
  readSnippets: vi.fn(() => []),
  writeSnippet: vi.fn(),
  deleteSnippet: vi.fn(),
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
import { GET, POST, DELETE } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/snippets route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: (prefix: string) => `${prefix}-test-${Date.now()}` },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    it('returns snippets via the grant-ops-sqlite module', async () => {
      const { readSnippets } = await import('../../../../../shared/grant-ops-sqlite');
      (readSnippets as ReturnType<typeof vi.fn>).mockReturnValue([
        {
          id: 'snip-1',
          grantId: 'g1',
          title: 'Boilerplate',
          content: 'test',
          category: 'general',
          createdAt: '2026-01-01',
        },
      ]);

      const mockReq = {
        url: 'http://localhost:3000/api/snippets?grantId=g1',
      } as unknown as NextRequest;
      const response = await GET(mockReq);
      const data = await (response as NextResponse).json();
      expect(data.snippets).toBeDefined();
      expect(data.snippets.length).toBe(1);
      expect(data.snippets[0].title).toBe('Boilerplate');
    });

    it('returns empty snippets array', async () => {
      const mockReq = { url: 'http://localhost:3000/api/snippets' } as unknown as NextRequest;
      const response = await GET(mockReq);
      const data = await (response as NextResponse).json();
      expect(data.snippets).toEqual([]);
    });
  });

  describe('POST', () => {
    it('returns 400 for invalid body', async () => {
      const { NextRequest } = await import('next/server');
      const mockReq = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/snippets', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(mockReq as unknown as NextRequest);
      expect(response.status).toBe(400);
    });

    it('creates a snippet with valid data', async () => {
      const { NextRequest } = await import('next/server');
      const mockReq = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/snippets', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Snippet', content: 'Hello' }),
      });
      const response = await POST(mockReq as unknown as NextRequest);
      const data = await (response as NextResponse).json();
      expect(response.status).toBe(201);
      expect(data.snippet.title).toBe('New Snippet');
    });
  });

  describe('DELETE', () => {
    it('returns 400 when no id provided', async () => {
      const mockReq = { url: 'http://localhost:3000/api/snippets' } as unknown as NextRequest;
      const response = await DELETE(mockReq);
      expect(response.status).toBe(400);
    });

    it('deletes a snippet by id', async () => {
      const mockReq = {
        url: 'http://localhost:3000/api/snippets?id=snip-1',
      } as unknown as NextRequest;
      const response = await DELETE(mockReq);
      const data = await (response as NextResponse).json();
      expect(data.success).toBe(true);
    });
  });
});
