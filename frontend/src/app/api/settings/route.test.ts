/**
 * Settings API Route Tests
 *
 * Tests the /api/settings GET and PUT routes.
 * Uses mocked globalThis.__grantOpsDb for database access.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: async () => {} };
});

import { GET, PUT } from './route';
import type { NextResponse } from 'next/server';

interface MockDb {
  prepare: ReturnType<typeof vi.fn>;
}

function createMockDb(): MockDb {
  const store: Record<string, string> = {};
  const stmt = {
    get: vi.fn((_key?: string) => undefined),
    run: vi.fn((key: string, value: string) => { store[key] = value; }),
    all: vi.fn((_prefix: string) => {
      return Object.entries(store)
        .filter(([k]) => k.startsWith('settings.'))
        .map(([key, value]) => ({ key, value }));
    }),
  };
  return {
    prepare: vi.fn(() => stmt),
  };
}

describe('/api/settings route', () => {
  let mockDb: MockDb;
  let stmt: ReturnType<MockDb['prepare']>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockDb = createMockDb();
    stmt = mockDb.prepare();
    (globalThis as Record<string, unknown>).__grantOpsDb = mockDb;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__grantOpsDb;
  });

  describe('GET', () => {
    it('returns empty settings when none stored', async () => {
      const response = await GET();
      const data = await (response as NextResponse).json();
      expect(data).toEqual({});
    });

    it('returns settings with settings.% prefix stripped', async () => {
      // Simulate stored settings
      const store: Record<string, string> = {
        'settings.agent.autoDraftThreshold': '75',
        'settings.crawl.intervalHours': '168',
        'settings.notifications.notifyEmail': 'test@example.com',
      };
      // Override all() to return from store
      stmt.all = vi.fn(() =>
        Object.entries(store).map(([key, value]) => ({ key, value }))
      );

      const response = await GET();
      const data = await (response as NextResponse).json();

      expect(data).toEqual({
        'agent.autoDraftThreshold': '75',
        'crawl.intervalHours': '168',
        'notifications.notifyEmail': 'test@example.com',
      });
    });

    it('returns 500 when database not available', async () => {
      delete (globalThis as Record<string, unknown>).__grantOpsDb;
      const response = await GET();
      const data = await (response as NextResponse).json();
      expect(response.status).toBe(500);
      expect(data.code).toBe('STORAGE_UNAVAILABLE');
    });
  });

  describe('PUT', () => {
    it('returns 400 for empty request body', async () => {
      const request = new Request('http://localhost:3000/api/settings', {
        method: 'PUT',
        body: null,
      });
      const response = await PUT(request);
      const _resData = await (response as NextResponse).json();
      expect(response.status).toBe(400);
      expect(_resData.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid JSON body', async () => {
      const request = new Request('http://localhost:3000/api/settings', {
        method: 'PUT',
        body: 'not-json',
      });
      const response = await PUT(request);
      const data = await (response as NextResponse).json();
      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('saves operatorName and returns updated settings', async () => {
      const request = new Request('http://localhost:3000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName: 'Test Op' }),
      });
      const response = await PUT(request);
      expect(response.status).toBe(200);
      void (response as NextResponse).json();
      expect(stmt.run).toHaveBeenCalledWith('operator.name', 'Test Op');
    });

    it('saves agent settings', async () => {
      const request = new Request('http://localhost:3000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentSettings: {
            autoDraftThreshold: 50,
            voiceAndTone: 'professional',
            maxConcurrentJobs: 5,
          },
        }),
      });
      await PUT(request);
      expect(stmt.run).toHaveBeenCalledWith('settings.agent.autoDraftThreshold', '50');
      expect(stmt.run).toHaveBeenCalledWith('settings.agent.voiceAndTone', 'professional');
      expect(stmt.run).toHaveBeenCalledWith('settings.agent.maxConcurrentJobs', '5');
    });

    it('saves crawl settings including boolean', async () => {
      const request = new Request('http://localhost:3000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crawlSettings: {
            intervalHours: 48,
            respectRobotsTxt: false,
            userAgent: 'TestBot/1.0',
          },
        }),
      });
      await PUT(request);
      expect(stmt.run).toHaveBeenCalledWith('settings.crawl.intervalHours', '48');
      expect(stmt.run).toHaveBeenCalledWith('settings.crawl.respectRobotsTxt', 'false');
      expect(stmt.run).toHaveBeenCalledWith('settings.crawl.userAgent', 'TestBot/1.0');
    });

    it('saves notification and backup settings', async () => {
      const request = new Request('http://localhost:3000/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationSettings: {
            notifyEmail: 'alert@example.com',
            notifyOnMatchAbove: 80,
            notifyOnDeadlineDays: 14,
          },
          backupSchedule: {
            intervalHours: 72,
            maxBackups: 5,
            enabled: true,
          },
        }),
      });
      await PUT(request);
      expect(stmt.run).toHaveBeenCalledWith('settings.notifications.notifyEmail', 'alert@example.com');
      expect(stmt.run).toHaveBeenCalledWith('settings.notifications.notifyOnMatchAbove', '80');
      expect(stmt.run).toHaveBeenCalledWith('settings.notifications.notifyOnDeadlineDays', '14');
      expect(stmt.run).toHaveBeenCalledWith('settings.backup.intervalHours', '72');
      expect(stmt.run).toHaveBeenCalledWith('settings.backup.maxBackups', '5');
      expect(stmt.run).toHaveBeenCalledWith('settings.backup.enabled', 'true');
    });
  });
});
