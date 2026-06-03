/**
 * Activity API Route Tests
 *
 * Tests the /api/activity endpoint for listing audit events.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../shared/grant-ops-sqlite', () => ({
  getSqliteState: vi.fn(() => ({})),
  readAuditEvents: vi.fn(() => []),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    connection: async () => {},
    NextRequest: class {
      url: string;
      method: string;
      constructor(url: string, init?: { method?: string }) {
        this.url = url;
        this.method = init?.method || 'GET';
      }
    },
  };
});

import { GET } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/activity route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns paginated activity events', async () => {
    const { readAuditEvents } = await import('../../../../../shared/grant-ops-sqlite');
    const mockEvents = [
      {
        id: 'evt-1',
        eventType: 'source.created',
        entityType: 'source',
        entityId: 'src-1',
        actor: 'operator',
        timestamp: '2026-01-01T00:00:00Z',
        details: {},
      },
      {
        id: 'evt-2',
        eventType: 'grant.submitted',
        entityType: 'grant',
        entityId: 'g-1',
        actor: 'operator',
        timestamp: '2026-01-02T00:00:00Z',
        details: {},
      },
    ];
    (readAuditEvents as ReturnType<typeof vi.fn>).mockReturnValue(mockEvents);

    const mockReq = {
      url: 'http://localhost:3000/api/activity?page=1&pageSize=10',
    } as unknown as NextRequest;
    const response = await GET(mockReq);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(200);
    expect(data.events).toBeDefined();
    expect(data.total).toBe(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(10);
  });

  it('filters by entityType', async () => {
    const { readAuditEvents } = await import('../../../../../shared/grant-ops-sqlite');
    const mockEvents = [
      {
        id: 'evt-1',
        eventType: 'source.created',
        entityType: 'source',
        entityId: 'src-1',
        actor: 'operator',
        timestamp: '2026-01-01T00:00:00Z',
        details: {},
      },
      {
        id: 'evt-2',
        eventType: 'grant.submitted',
        entityType: 'grant',
        entityId: 'g-1',
        actor: 'operator',
        timestamp: '2026-01-02T00:00:00Z',
        details: {},
      },
    ];
    (readAuditEvents as ReturnType<typeof vi.fn>).mockReturnValue(mockEvents);

    const mockReq = {
      url: 'http://localhost:3000/api/activity?entityType=source',
    } as unknown as NextRequest;
    const response = await GET(mockReq);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(200);
    expect(data.events.length).toBe(1);
    expect(data.events[0].entityType).toBe('source');
  });

  it('returns 400 for invalid page parameter', async () => {
    const { readAuditEvents } = await import('../../../../../shared/grant-ops-sqlite');
    (readAuditEvents as ReturnType<typeof vi.fn>).mockReturnValue([]);

    const mockReq = {
      url: 'http://localhost:3000/api/activity?page=-1',
    } as unknown as NextRequest;
    const response = await GET(mockReq);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(400);
    expect(data.error).toBeTruthy();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns empty events when none exist', async () => {
    const { readAuditEvents } = await import('../../../../../shared/grant-ops-sqlite');
    (readAuditEvents as ReturnType<typeof vi.fn>).mockReturnValue([]);

    const mockReq = {
      url: 'http://localhost:3000/api/activity',
    } as unknown as NextRequest;
    const response = await GET(mockReq);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(200);
    expect(data.events).toEqual([]);
    expect(data.total).toBe(0);
  });
});
