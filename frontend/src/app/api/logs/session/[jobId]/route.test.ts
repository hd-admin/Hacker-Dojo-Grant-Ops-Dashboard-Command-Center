import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/logger', () => ({
  getSessionLogPath: (jobId: string) =>
    path.join(process.cwd(), '.grant-ops-data', 'logs', `session-${jobId}.log`),
  logger: { error: vi.fn() },
}));

describe('/api/logs/session/[jobId] route', () => {
  const logDir = path.join(process.cwd(), '.grant-ops-data', 'logs');

  beforeEach(() => {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  });

  afterEach(() => {
    const sessionFiles = fs
      .readdirSync(logDir)
      .filter((f) => f.startsWith('session-') && f.endsWith('.log'));
    for (const file of sessionFiles) {
      fs.unlinkSync(path.join(logDir, file));
    }
  });

  it('returns paginated session log entries', async () => {
    const jobId = 'test-job-1';
    const logFile = path.join(logDir, `session-${jobId}.log`);
    const lines = Array.from({ length: 100 }, (_, i) => `Session log line ${i + 1}`);
    fs.writeFileSync(logFile, lines.join('\n'));

    const request = new Request(
      `http://localhost/api/logs/session/${jobId}?page=1&pageSize=10`,
    ) as unknown as import('next/server').NextRequest;
    const response = await GET(request, { params: Promise.resolve({ jobId }) });
    const data = (await response.json()) as {
      entries: string[];
      count: number;
      page: number;
      pageSize: number;
      totalEntries: number;
    };

    expect(response.status).toBe(200);
    expect(data.entries.length).toBe(10);
    expect(data.count).toBe(10);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(10);
    expect(data.totalEntries).toBe(100);
  });

  it('returns second page correctly', async () => {
    const jobId = 'test-job-2';
    const logFile = path.join(logDir, `session-${jobId}.log`);
    const lines = Array.from({ length: 100 }, (_, i) => `Session log line ${i + 1}`);
    fs.writeFileSync(logFile, lines.join('\n'));

    const request = new Request(
      `http://localhost/api/logs/session/${jobId}?page=2&pageSize=10`,
    ) as unknown as import('next/server').NextRequest;
    const response = await GET(request, { params: Promise.resolve({ jobId }) });
    const data = (await response.json()) as {
      entries: string[];
      count: number;
      page: number;
      pageSize: number;
      totalEntries: number;
    };

    expect(response.status).toBe(200);
    expect(data.entries.length).toBe(10);
    expect(data.page).toBe(2);
    expect(data.entries[0]).toBe('Session log line 11');
  });

  it('returns empty result when no session log exists', async () => {
    const jobId = 'nonexistent-job';
    const request = new Request(
      `http://localhost/api/logs/session/${jobId}`,
    ) as unknown as import('next/server').NextRequest;
    const response = await GET(request, { params: Promise.resolve({ jobId }) });
    const data = (await response.json()) as {
      entries: string[];
      count: number;
      page: number;
      pageSize: number;
      totalEntries: number;
      note?: string;
    };

    expect(response.status).toBe(200);
    expect(data.entries.length).toBe(0);
    expect(data.count).toBe(0);
    expect(data.totalEntries).toBe(0);
    expect(data.note).toContain('No session log found');
  });

  it('returns 400 for invalid page parameter', async () => {
    const jobId = 'test-job-3';
    const request = new Request(
      `http://localhost/api/logs/session/${jobId}?page=0`,
    ) as unknown as import('next/server').NextRequest;
    const response = await GET(request, { params: Promise.resolve({ jobId }) });
    expect(response.status).toBe(400);
  });
});
