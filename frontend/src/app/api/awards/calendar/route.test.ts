/**
 * Awards Calendar API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/grant-ops/award-service', () => ({
  getComplianceCalendar: vi.fn().mockResolvedValue([]),
}));
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import { getComplianceCalendar } from '@/server/grant-ops/award-service';
import { GET } from './route';
import type { NextResponse } from 'next/server';

describe('/api/awards/calendar route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns compliance calendar events', async () => {
    const mockEvents = [{ id: 'ev1', title: 'Report Due', date: '2026-12-15' }];
    (getComplianceCalendar as ReturnType<typeof vi.fn>).mockResolvedValue(mockEvents);
    const response = await GET();
    const data = await (response as NextResponse).json();
    expect(data.events).toEqual(mockEvents);
  });

  it('returns empty events array', async () => {
    (getComplianceCalendar as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const response = await GET();
    const data = await (response as NextResponse).json();
    expect(data.events).toEqual([]);
  });
});
