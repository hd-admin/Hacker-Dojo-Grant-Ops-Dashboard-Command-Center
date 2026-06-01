/**
 * Saved Searches API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../shared/grant-ops-persistence', () => ({
  loadSavedSearches: vi.fn().mockResolvedValue([]),
  saveSavedSearches: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import { loadSavedSearches } from '../../../../../shared/grant-ops-persistence';
import { GET, POST } from './route';
import type { NextRequest, NextResponse } from 'next/server';
import type { SavedSearch } from '../../../../../shared/types';

describe('/api/saved-searches route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns saved searches', async () => {
    const mockSearches: SavedSearch[] = [
      {
        id: 'ss-1',
        name: 'Test',
        queryText: '',
        filters: {},
        newResultsCount: 0,
        lastCheckedAt: '',
        createdAt: '',
      },
    ];
    (loadSavedSearches as ReturnType<typeof vi.fn>).mockResolvedValue(mockSearches);
    const response = await GET();
    const data = await (response as NextResponse).json();
    expect(data).toEqual(mockSearches);
  });

  it('returns empty array when no searches', async () => {
    (loadSavedSearches as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const response = await GET();
    const data = await (response as NextResponse).json();
    expect(data).toEqual([]);
  });

  it('creates a saved search', async () => {
    (loadSavedSearches as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const req = new Request('http://localhost/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Search' }),
    });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(201);
    const data = await (response as NextResponse).json();
    expect(data.name).toBe('New Search');
  });

  it('returns 400 when name is missing', async () => {
    const req = new Request('http://localhost/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await POST(req as unknown as NextRequest);
    expect(response.status).toBe(400);
  });
});
