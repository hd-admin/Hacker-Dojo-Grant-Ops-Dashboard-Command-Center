/**
 * Pipeline CSV API Route Tests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/grant-ops/repository', () => ({
  getGrants: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/server/grant-ops/dashboard-service', () => ({
  generatePipelineReport: vi.fn().mockReturnValue([]),
}));
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import { getGrants } from '@/server/grant-ops/repository';
import { GET } from './route';

describe('/api/reports/pipeline/csv route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns CSV with header row when empty', async () => {
    (getGrants as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);
    const headers = (response as Response).headers;
    expect(headers.get('Content-Type')).toBe('text/csv');
    const csv = await (response as Response).text();
    expect(csv).toContain('title,funder,status,deadline');
  });

  it('returns CSV with data rows', async () => {
    const { generatePipelineReport } = await import('@/server/grant-ops/dashboard-service');
    (generatePipelineReport as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        title: 'Grant A',
        funder: 'F1',
        status: 'matched',
        deadline: '2026-12-31',
        awardAmount: '$50,000',
        daysOut: 200,
        responsibilityTag: 'finance',
      },
    ]);
    const response = await GET();
    const csv = await (response as Response).text();
    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]).toContain('Grant A');
  });
});
