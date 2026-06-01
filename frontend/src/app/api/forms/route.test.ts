/**
 * Forms API Route Tests
 *
 * Tests the /api/forms GET, POST, PUT, DELETE routes.
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
import { GET, POST, PUT, DELETE } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/forms route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockRepo = {
      getFormTemplates: vi.fn().mockResolvedValue([]),
      createFormTemplate: vi.fn().mockResolvedValue(undefined),
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
    it('returns forms list', async () => {
      const mockForms = [
        { id: 'form-1', name: 'Test Form', funderId: null, fields: [], createdAt: '2026-01-01' },
      ];
      const deps = getDependencies();
      (deps.repository.getFormTemplates as ReturnType<typeof vi.fn>).mockResolvedValue(mockForms);

      const mockReq = { url: 'http://localhost:3000/api/forms' } as unknown as NextRequest;
      const response = await GET(mockReq);
      const data = await (response as NextResponse).json();
      expect(data.forms).toEqual(mockForms);
    });

    it('returns empty list when no forms exist', async () => {
      const mockReq = { url: 'http://localhost:3000/api/forms' } as unknown as NextRequest;
      const response = await GET(mockReq);
      const data = await (response as NextResponse).json();
      expect(data.forms).toEqual([]);
    });
  });

  describe('POST', () => {
    it('creates a form with valid data', async () => {
      const { NextRequest } = await import('next/server');
      const mockReq = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/forms', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Form' }),
      });
      const response = await POST(mockReq as unknown as NextRequest);
      const data = await (response as NextResponse).json();
      expect(data.form).toBeDefined();
      expect(data.form.name).toBe('New Form');
    });

    it('returns 400 for invalid body', async () => {
      const { NextRequest } = await import('next/server');
      const mockReq = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/forms', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(mockReq as unknown as NextRequest);
      expect(response.status).toBe(400);
    });
  });

  describe('PUT', () => {
    it('returns 400 when no id provided', async () => {
      const { NextRequest } = await import('next/server');
      const mockReq = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/forms', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Form' }),
      });
      const response = await PUT(mockReq as unknown as NextRequest);
      const data = await (response as NextResponse).json();
      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('updates a form with valid data and id', async () => {
      const { NextRequest } = await import('next/server');
      const mockReq = new (NextRequest as unknown as new (
        url: string,
        init?: Record<string, unknown>,
      ) => Request)('http://localhost:3000/api/forms', {
        method: 'PUT',
        body: JSON.stringify({ id: 'form-1', name: 'Updated Form' }),
      });
      const response = await PUT(mockReq as unknown as NextRequest);
      const data = await (response as NextResponse).json();
      expect(data.form).toBeDefined();
      expect(data.form.name).toBe('Updated Form');
      expect(data.form.id).toBe('form-1');
    });
  });

  describe('DELETE', () => {
    it('returns 400 when no id param', async () => {
      const mockReq = { url: 'http://localhost:3000/api/forms' } as unknown as NextRequest;
      const response = await DELETE(mockReq);
      const data = await (response as NextResponse).json();
      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('deletes a form by id', async () => {
      const mockReq = {
        url: 'http://localhost:3000/api/forms?id=form-1',
      } as unknown as NextRequest;
      const response = await DELETE(mockReq);
      const data = await (response as NextResponse).json();
      expect(data.success).toBe(true);
    });
  });
});
