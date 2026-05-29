import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureProPublicaSourceRegistered, fetchProPublicaGrants } = vi.hoisted(() => ({
  ensureProPublicaSourceRegistered: vi.fn(),
  fetchProPublicaGrants: vi.fn(),
}));

vi.mock('@/server/grant-ops/propublica-service', () => ({
  ensureProPublicaSourceRegistered,
  fetchProPublicaGrants,
}));

vi.mock('@/server/grant-ops/opencode-client', () => ({
  classifyOpencodeError: vi.fn().mockReturnValue('unknown'),
}));

vi.mock('@/lib/failure-messages', () => ({
  opencodeFailureMessages: {},
}));

import { GET } from './route';

describe('/api/sources/propublica route', () => {
  beforeEach(() => {
    ensureProPublicaSourceRegistered.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 with QUERY_REQUIRED when query param is missing', async () => {
    const response = await GET(new Request('http://localhost/api/sources/propublica') as never);
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('QUERY_REQUIRED');
  });

  it('returns 400 with QUERY_TOO_LONG when query exceeds 500 chars', async () => {
    const longQuery = 'x'.repeat(501);
    const response = await GET(new Request(`http://localhost/api/sources/propublica?query=${longQuery}`) as never);
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('QUERY_TOO_LONG');
  });

  it('returns grants array on success', async () => {
    fetchProPublicaGrants.mockResolvedValue({ grants: [{ id: 'g1', title: 'Test Grant' }] });
    const response = await GET(new Request('http://localhost/api/sources/propublica?query=education') as never);
    expect(response.status).toBe(200);
    const body = await response.json() as { grants: unknown[] };
    expect(body.grants.length).toBe(1);
  });

  it('returns unavailable flag when service is unavailable', async () => {
    fetchProPublicaGrants.mockResolvedValue({ unavailable: true });
    const response = await GET(new Request('http://localhost/api/sources/propublica?query=education') as never);
    expect(response.status).toBe(200);
    const body = await response.json() as { unavailable: boolean; grants: unknown[] };
    expect(body.unavailable).toBe(true);
    expect(body.grants.length).toBe(0);
  });

  it('returns error info when service returns error', async () => {
    fetchProPublicaGrants.mockResolvedValue({ error: 'connection failed' });
    const response = await GET(new Request('http://localhost/api/sources/propublica?query=education') as never);
    expect(response.status).toBe(200);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('connection failed');
  });
});
