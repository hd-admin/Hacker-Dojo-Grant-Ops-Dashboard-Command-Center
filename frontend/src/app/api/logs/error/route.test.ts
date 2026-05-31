import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

describe('/api/logs/error route', () => {
  const logDir = path.join(process.cwd(), '.grant-ops-data', 'logs');

  beforeEach(() => {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir).filter((f) => f.startsWith('error') && f.endsWith('.log'));
      for (const file of files) {
        fs.unlinkSync(path.join(logDir, file));
      }
    }
  });

  it('returns paginated error log entries', async () => {
    const logFile = path.join(logDir, 'error-test.log');
    const lines = Array.from({ length: 100 }, (_, i) => `Error line ${i + 1}`);
    fs.writeFileSync(logFile, lines.join('\n'));

    const request = new Request('http://localhost/api/logs/error?page=1&pageSize=10') as unknown as import('next/server').NextRequest;
    const response = await GET(request);
    const data = await response.json() as { entries: string[]; count: number; page: number; pageSize: number; totalEntries: number };

    expect(response.status).toBe(200);
    expect(data.entries.length).toBe(10);
    expect(data.count).toBe(10);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(10);
    expect(data.totalEntries).toBe(100);
  });

  it('returns second page correctly', async () => {
    const logFile = path.join(logDir, 'error-test.log');
    const lines = Array.from({ length: 100 }, (_, i) => `Error line ${i + 1}`);
    fs.writeFileSync(logFile, lines.join('\n'));

    const request = new Request('http://localhost/api/logs/error?page=2&pageSize=10') as unknown as import('next/server').NextRequest;
    const response = await GET(request);
    const data = await response.json() as { entries: string[]; count: number; page: number; pageSize: number; totalEntries: number };

    expect(response.status).toBe(200);
    expect(data.entries.length).toBe(10);
    expect(data.page).toBe(2);
    expect(data.entries[0]).toBe('Error line 11');
  });

  it('defaults to page 1 and pageSize 50', async () => {
    const logFile = path.join(logDir, 'error-test.log');
    const lines = Array.from({ length: 60 }, (_, i) => `Error line ${i + 1}`);
    fs.writeFileSync(logFile, lines.join('\n'));

    const request = new Request('http://localhost/api/logs/error') as unknown as import('next/server').NextRequest;
    const response = await GET(request);
    const data = await response.json() as { entries: string[]; count: number; page: number; pageSize: number; totalEntries: number };

    expect(response.status).toBe(200);
    expect(data.entries.length).toBe(50);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(50);
  });

  it('returns 400 for invalid page parameter', async () => {
    const request = new Request('http://localhost/api/logs/error?page=0') as unknown as import('next/server').NextRequest;
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('filters error log entries by level parameter', async () => {
    const logFile = path.join(logDir, 'error-level-test.log');
    const mixedLines = [
      JSON.stringify({ level: 40, msg: 'warn message', time: Date.now() }),
      JSON.stringify({ level: 50, msg: 'error message', time: Date.now() }),
      JSON.stringify({ level: 40, msg: 'another warn', time: Date.now() }),
      JSON.stringify({ level: 50, msg: 'another error', time: Date.now() }),
    ];
    fs.writeFileSync(logFile, mixedLines.join('\n'));

    const request = new Request('http://localhost/api/logs/error?level=error') as unknown as import('next/server').NextRequest;
    const response = await GET(request);
    const data = await response.json() as { entries: string[]; count: number; totalEntries: number };

    expect(response.status).toBe(200);
    expect(data.totalEntries).toBe(2);
    expect(data.count).toBe(2);
    for (const entry of data.entries) {
      const parsed = JSON.parse(entry) as { level: number };
      expect(parsed.level).toBe(50);
    }
  });

  it('skips non-JSON lines when filtering error logs by level', async () => {
    const logFile = path.join(logDir, 'error-level-mixed.log');
    const mixedLines = [
      'Plain text error line',
      JSON.stringify({ level: 50, msg: 'error message', time: Date.now() }),
      'Another plain text line',
    ];
    fs.writeFileSync(logFile, mixedLines.join('\n'));

    const request = new Request('http://localhost/api/logs/error?level=error') as unknown as import('next/server').NextRequest;
    const response = await GET(request);
    const data = await response.json() as { entries: string[]; count: number; totalEntries: number };

    expect(response.status).toBe(200);
    expect(data.totalEntries).toBe(1);
    expect(data.count).toBe(1);
    const parsed = JSON.parse(data.entries[0]!) as { level: number };
    expect(parsed.level).toBe(50);
  });
});
