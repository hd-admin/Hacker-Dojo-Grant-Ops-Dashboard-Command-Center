/**
 * Operator API Route Tests
 *
 * Tests the /api/operator GET and POST routes.
 * Uses mocked globalThis.__grantOpsDb for database access.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import { GET, POST } from './route';
import { NextResponse } from 'next/server';

interface MockDb {
  prepare: ReturnType<typeof vi.fn>;
}

function createMockDb(storedName = ''): MockDb {
  const stmt = {
    get: vi.fn(() => (storedName ? { value: storedName } : undefined)),
    run: vi.fn(),
  };
  return {
    prepare: vi.fn(() => stmt),
  };
}

describe('/api/operator route', () => {
  let mockDb: MockDb;
  let stmt: ReturnType<MockDb['prepare']>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockDb = createMockDb();
    stmt = mockDb.prepare();
    (globalThis as Record<string, unknown>).__grantOpsDb = mockDb;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__grantOpsDb;
  });

  describe('GET', () => {
    it('returns empty name when no operator stored', async () => {
      const response = await GET();
      const data = await (response as NextResponse).json();
      expect(data).toEqual({ name: '' });
    });

    it('returns stored operator name', async () => {
      const db = createMockDb('Jane Doe');
      (globalThis as Record<string, unknown>).__grantOpsDb = db;
      const response = await GET();
      const data = await (response as NextResponse).json();
      expect(data).toEqual({ name: 'Jane Doe' });
    });

    it('returns empty name when database not available', async () => {
      delete (globalThis as Record<string, unknown>).__grantOpsDb;
      const response = await GET();
      const data = await (response as NextResponse).json();
      expect(data).toEqual({ name: '' });
    });
  });

  describe('POST', () => {
    it('saves operator name and returns it', async () => {
      const request = new Request('http://localhost:3000/api/operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John Smith' }),
      });
      const response = await POST(request);
      const data = await (response as NextResponse).json();
      expect(data).toEqual({ name: 'John Smith' });
      expect(stmt.run).toHaveBeenCalledWith('operator.name', 'John Smith');
    });

    it('returns 400 for empty name', async () => {
      const request = new Request('http://localhost:3000/api/operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });
      const response = await POST(request);
      const data = await (response as NextResponse).json();
      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing body', async () => {
      const request = new Request('http://localhost:3000/api/operator', {
        method: 'POST',
        body: null,
      });
      const response = await POST(request);
      const data = await (response as NextResponse).json();
      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for body without name field', async () => {
      const request = new Request('http://localhost:3000/api/operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other: 'value' }),
      });
      const response = await POST(request);
      const data = await (response as NextResponse).json();
      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 500 when database not available', async () => {
      delete (globalThis as Record<string, unknown>).__grantOpsDb;
      const request = new Request('http://localhost:3000/api/operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });
      const response = await POST(request);
      const data = await (response as NextResponse).json();
      expect(response.status).toBe(500);
      expect(data.code).toBe('STORAGE_UNAVAILABLE');
    });
  });
});
