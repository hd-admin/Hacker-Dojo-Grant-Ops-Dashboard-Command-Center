/**
 * Document Versions API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/grant-ops/document-service', () => ({
  getDocument: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/server/grant-ops/dependencies', () => ({
  getDependencies: vi.fn(),
  setDependencies: vi.fn(), resetDependencies: vi.fn(), createDependencies: vi.fn(),
}));
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import * as documentService from '@/server/grant-ops/document-service';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { GET, POST } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/documents/[docId]/versions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { updateDocument: vi.fn().mockResolvedValue(undefined) },
      idGenerator: { generateId: (p: string) => `${p}-test` },
      clock: { now: () => new Date('2026-06-01') },
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 404 when document not found (GET)', async () => {
    (documentService.getDocument as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new Request('http://localhost/api/documents/doc1/versions');
    const response = await GET(req as unknown as NextRequest, { params: Promise.resolve({ docId: 'doc1' }) });
    expect(response.status).toBe(404);
  });

  it('returns versions for a document (GET)', async () => {
    (documentService.getDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'doc1', filename: 'test.pdf', versions: [{ id: 'v1', documentId: 'doc1', versionNumber: 1, uploadedAt: '2026-01-01', storagePath: '/tmp/test.pdf' }],
    });
    const req = new Request('http://localhost/api/documents/doc1/versions');
    const response = await GET(req as unknown as NextRequest, { params: Promise.resolve({ docId: 'doc1' }) });
    const data = await (response as NextResponse).json();
    expect(data.length).toBe(1);
  });

  it('returns 404 when document not found (POST)', async () => {
    (documentService.getDocument as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new Request('http://localhost/api/documents/doc1/versions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: '/tmp/new.pdf' }),
    });
    const response = await POST(req as unknown as NextRequest, { params: Promise.resolve({ docId: 'doc1' }) });
    expect(response.status).toBe(404);
  });

  it('creates a new version (POST)', async () => {
    (documentService.getDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'doc1', filename: 'test.pdf', versions: [],
    });
    const req = new Request('http://localhost/api/documents/doc1/versions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath: '/tmp/new.pdf', notes: 'Updated' }),
    });
    const response = await POST(req as unknown as NextRequest, { params: Promise.resolve({ docId: 'doc1' }) });
    expect(response.status).toBe(201);
    const data = await (response as NextResponse).json();
    expect(data.versionNumber).toBe(1);
    expect(data.notes).toBe('Updated');
  });

  it('returns 400 for invalid POST body', async () => {
    const req = new Request('http://localhost/api/documents/doc1/versions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    const response = await POST(req as unknown as NextRequest, { params: Promise.resolve({ docId: 'doc1' }) });
    expect(response.status).toBe(400);
  });
});
