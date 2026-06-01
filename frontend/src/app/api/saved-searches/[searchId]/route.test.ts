/**
 * Saved Searches [searchId] API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../../shared/grant-ops-persistence', () => ({
  loadSavedSearches: vi.fn().mockResolvedValue([]),
  saveSavedSearches: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import {
  loadSavedSearches,
  saveSavedSearches,
} from '../../../../../../shared/grant-ops-persistence';
import { PUT, DELETE } from './route';
import type { NextRequest, NextResponse } from 'next/server';

describe('/api/saved-searches/[searchId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (loadSavedSearches as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'ss-1',
        name: 'Test',
        queryText: '',
        filters: {},
        newResultsCount: 0,
        lastCheckedAt: '',
        createdAt: '',
      },
    ]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates a saved search', async () => {
    const req = new Request('http://localhost/api/saved-searches/ss-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const response = await PUT(req as unknown as NextRequest, {
      params: Promise.resolve({ searchId: 'ss-1' }),
    });
    const data = await (response as NextResponse).json();
    expect(data.name).toBe('Updated');
  });

  it('returns 404 when search not found', async () => {
    const req = new Request('http://localhost/api/saved-searches/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const response = await PUT(req as unknown as NextRequest, {
      params: Promise.resolve({ searchId: 'nonexistent' }),
    });
    expect(response.status).toBe(404);
  });

  it('deletes a saved search', async () => {
    const req = new Request('http://localhost/api/saved-searches/ss-1', { method: 'DELETE' });
    const response = await DELETE(req as unknown as NextRequest, {
      params: Promise.resolve({ searchId: 'ss-1' }),
    });
    const data = await (response as NextResponse).json();
    expect(data.success).toBe(true);
    expect(saveSavedSearches).toHaveBeenCalled();
  });

  it('returns 404 when deleting nonexistent search', async () => {
    const req = new Request('http://localhost/api/saved-searches/nonexistent', {
      method: 'DELETE',
    });
    const response = await DELETE(req as unknown as NextRequest, {
      params: Promise.resolve({ searchId: 'nonexistent' }),
    });
    expect(response.status).toBe(404);
  });
});
