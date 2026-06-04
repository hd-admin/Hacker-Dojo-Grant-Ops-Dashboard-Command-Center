/**
 * Activity API Route Tests
 *
 * Tests the /api/activity endpoint for listing audit events.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Note: we do NOT mock grant-ops-sqlite here because vi.mock is hoisted and
// cached globally, which breaks other test files. Instead, we spy on the
// dynamically imported functions inside each test.


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
    const sqlite = await import('../../../../../shared/grant-ops-sqlite');
    const mockEvents = [
      {
        id: 'evt-1',
        eventType: 'source.created',
        entityType: 'source',
        entityId: 'src-1',
        actor: 'operator',
        actorLabel: 'operator',
        timestamp: '2026-01-01T00:00:00Z',
        details: {},
      },
      {
        id: 'evt-2',
        eventType: 'grant.submitted',
        entityType: 'grant',
        entityId: 'g-1',
        actor: 'operator',
        actorLabel: 'operator',
        timestamp: '2026-01-02T00:00:00Z',
        details: {},
      },
    ];
    const readAuditEventsSpy = vi.spyOn(sqlite, 'readAuditEvents').mockReturnValue(mockEvents);

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
    readAuditEventsSpy.mockRestore();
  });

  it('filters by entityType', async () => {
    const sqlite = await import('../../../../../shared/grant-ops-sqlite');
    const mockEvents = [
      {
        id: 'evt-1',
        eventType: 'source.created',
        entityType: 'source',
        entityId: 'src-1',
        actor: 'operator',
        actorLabel: 'operator',
        timestamp: '2026-01-01T00:00:00Z',
        details: {},
      },
      {
        id: 'evt-2',
        eventType: 'grant.submitted',
        entityType: 'grant',
        entityId: 'g-1',
        actor: 'operator',
        actorLabel: 'operator',
        timestamp: '2026-01-02T00:00:00Z',
        details: {},
      },
    ];
    const readAuditEventsSpy = vi.spyOn(sqlite, 'readAuditEvents').mockReturnValue(mockEvents);

    const mockReq = {
      url: 'http://localhost:3000/api/activity?entityType=source',
    } as unknown as NextRequest;
    const response = await GET(mockReq);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(200);
    expect(data.events.length).toBe(1);
    expect(data.events[0].entityType).toBe('source');
    readAuditEventsSpy.mockRestore();
  });

  it('returns 400 for invalid page parameter', async () => {
    const sqlite = await import('../../../../../shared/grant-ops-sqlite');
    const readAuditEventsSpy = vi.spyOn(sqlite, 'readAuditEvents').mockReturnValue([]);

    const mockReq = {
      url: 'http://localhost:3000/api/activity?page=-1',
    } as unknown as NextRequest;
    const response = await GET(mockReq);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(400);
    expect(data.error).toBeTruthy();
    expect(data.code).toBe('VALIDATION_ERROR');
    readAuditEventsSpy.mockRestore();
  });

  it('returns empty events when none exist', async () => {
    const sqlite = await import('../../../../../shared/grant-ops-sqlite');
    const readAuditEventsSpy = vi.spyOn(sqlite, 'readAuditEvents').mockReturnValue([]);

    const mockReq = {
      url: 'http://localhost:3000/api/activity',
    } as unknown as NextRequest;
    const response = await GET(mockReq);
    const data = await (response as NextResponse).json();

    expect(response.status).toBe(200);
    expect(data.events).toEqual([]);
    expect(data.total).toBe(0);
    readAuditEventsSpy.mockRestore();
  });
});
