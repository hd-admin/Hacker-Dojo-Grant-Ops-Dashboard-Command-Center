/**
 * Configure OpenCode API Route Tests
 *
 * Tests the /api/testing/configure-opencode endpoint.
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
import { POST } from './route';
import type { NextResponse } from 'next/server';

describe('/api/testing/configure-opencode route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configures opencode with valid payload', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { updateOpencodeSettings: mockUpdate },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });

    const { NextRequest } = await import('next/server');
    const req = new (NextRequest as unknown as new (
      url: string,
      init?: Record<string, unknown>,
    ) => Request)('http://localhost:3000/api/testing/configure-opencode', {
      method: 'POST',
      body: JSON.stringify({
        binaryPath: '/usr/local/bin/opencode',
        workingDirectory: '/tmp/opencode',
      }),
    });
    const response = await POST(req as unknown as Request);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        binaryPath: '/usr/local/bin/opencode',
        workingDirectory: '/tmp/opencode',
        isConfigured: true,
      }),
    );
  });

  it('configures opencode with optional timeoutMs', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: { updateOpencodeSettings: mockUpdate },
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });

    const { NextRequest } = await import('next/server');
    const req = new (NextRequest as unknown as new (
      url: string,
      init?: Record<string, unknown>,
    ) => Request)('http://localhost:3000/api/testing/configure-opencode', {
      method: 'POST',
      body: JSON.stringify({
        binaryPath: '/usr/local/bin/opencode',
        workingDirectory: '/tmp/opencode',
        timeoutMs: 30000,
      }),
    });
    const response = await POST(req as unknown as Request);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 30000 }));
  });

  it('returns 400 for missing binaryPath', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });

    const { NextRequest } = await import('next/server');
    const req = new (NextRequest as unknown as new (
      url: string,
      init?: Record<string, unknown>,
    ) => Request)('http://localhost:3000/api/testing/configure-opencode', {
      method: 'POST',
      body: JSON.stringify({ workingDirectory: '/tmp' }),
    });
    const response = await POST(req as unknown as Request);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(400);
    expect(data.error).toBeTruthy();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing workingDirectory', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });

    const { NextRequest } = await import('next/server');
    const req = new (NextRequest as unknown as new (
      url: string,
      init?: Record<string, unknown>,
    ) => Request)('http://localhost:3000/api/testing/configure-opencode', {
      method: 'POST',
      body: JSON.stringify({ binaryPath: '/usr/bin/oc' }),
    });
    const response = await POST(req as unknown as Request);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(400);
    expect(data.error).toBeTruthy();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for empty binaryPath', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });

    const { NextRequest } = await import('next/server');
    const req = new (NextRequest as unknown as new (
      url: string,
      init?: Record<string, unknown>,
    ) => Request)('http://localhost:3000/api/testing/configure-opencode', {
      method: 'POST',
      body: JSON.stringify({ binaryPath: '', workingDirectory: '/tmp' }),
    });
    const response = await POST(req as unknown as Request);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(400);
    expect(data.error).toBeTruthy();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for empty payload body', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });

    const { NextRequest } = await import('next/server');
    const req = new (NextRequest as unknown as new (
      url: string,
      init?: Record<string, unknown>,
    ) => Request)('http://localhost:3000/api/testing/configure-opencode', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(req as unknown as Request);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(400);
    expect(data.error).toBeTruthy();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('handles null body gracefully', async () => {
    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: {},
      idGenerator: { generateId: (p: string) => `${p}-test` },
    });

    const req = {
      url: 'http://localhost:3000/api/testing/configure-opencode',
      method: 'POST',
      json: () => Promise.resolve(null),
    } as unknown as Request;
    const response = await POST(req);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(400);
    expect(data.error).toBeTruthy();
    expect(data.code).toBe('VALIDATION_ERROR');
  });
});
