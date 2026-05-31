import { NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { createErrorResponse, withZodValidation } from '@/lib/api-helpers';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface GrantOpsDb {
  prepare(sql: string): { get(key: string): { value: string } | undefined; run(key: string, value: string): void; all(...args: string[]): { key: string; value: string }[] };
}

interface GrantOpsGlobal {
  __grantOpsDb?: GrantOpsDb;
}

function getDb(): GrantOpsDb | undefined {
  return (globalThis as unknown as GrantOpsGlobal).__grantOpsDb;
}

const SettingsBodySchema = z.object({
  operatorName: z.string().min(1).optional(),
  agentSettings: z.object({
    autoDraftThreshold: z.number().int().min(0).max(100).optional(),
    voiceAndTone: z.string().optional(),
    maxConcurrentJobs: z.number().int().min(1).max(10).optional(),
  }).optional(),
  crawlSettings: z.object({
    intervalHours: z.number().int().min(1).optional(),
    maxConcurrentCrawls: z.number().int().min(1).max(10).optional(),
    requestDelayMs: z.number().int().min(0).optional(),
    respectRobotsTxt: z.boolean().optional(),
    userAgent: z.string().optional(),
  }).optional(),
  notificationSettings: z.object({
    notifyEmail: z.string().optional(),
    notifyOnMatchAbove: z.number().int().min(0).max(100).optional(),
    notifyOnDeadlineDays: z.number().int().min(1).optional(),
  }).optional(),
  backupSchedule: z.object({
    intervalHours: z.number().int().min(1).optional(),
    maxBackups: z.number().int().min(1).optional(),
    enabled: z.boolean().optional(),
  }).optional(),
});

function setSetting(db: GrantOpsDb, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
}

function getSettings(db: GrantOpsDb): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM meta WHERE key LIKE ?').all('settings.%');
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key.replace('settings.', '')] = row.value;
  }
  return result;
}

export async function GET() {
  await connection();
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Database not available'), { status: 500 });
    }
    const settings = getSettings(db);
    return NextResponse.json(settings);
  } catch (error) {
    logger.error({ err: error }, 'Error reading settings');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to read settings'), { status: 500 });
  }
}

export async function PUT(request: Request) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(createErrorResponse('VALIDATION_ERROR', 'Request body is required'), { status: 400 });
    }

    const validation = withZodValidation(SettingsBodySchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Database not available'), { status: 500 });
    }

    const { operatorName, agentSettings, crawlSettings, notificationSettings, backupSchedule } = validation.data;

    if (operatorName !== undefined) {
      setSetting(db, 'operator.name', operatorName);
    }
    if (agentSettings) {
      if (agentSettings.autoDraftThreshold !== undefined) {
        setSetting(db, 'settings.agent.autoDraftThreshold', String(agentSettings.autoDraftThreshold));
      }
      if (agentSettings.voiceAndTone !== undefined) {
        setSetting(db, 'settings.agent.voiceAndTone', agentSettings.voiceAndTone);
      }
      if (agentSettings.maxConcurrentJobs !== undefined) {
        setSetting(db, 'settings.agent.maxConcurrentJobs', String(agentSettings.maxConcurrentJobs));
      }
    }
    if (crawlSettings) {
      if (crawlSettings.intervalHours !== undefined) {
        setSetting(db, 'settings.crawl.intervalHours', String(crawlSettings.intervalHours));
      }
      if (crawlSettings.maxConcurrentCrawls !== undefined) {
        setSetting(db, 'settings.crawl.maxConcurrentCrawls', String(crawlSettings.maxConcurrentCrawls));
      }
      if (crawlSettings.requestDelayMs !== undefined) {
        setSetting(db, 'settings.crawl.requestDelayMs', String(crawlSettings.requestDelayMs));
      }
      if (crawlSettings.respectRobotsTxt !== undefined) {
        setSetting(db, 'settings.crawl.respectRobotsTxt', String(crawlSettings.respectRobotsTxt));
      }
      if (crawlSettings.userAgent !== undefined) {
        setSetting(db, 'settings.crawl.userAgent', crawlSettings.userAgent);
      }
    }
    if (notificationSettings) {
      if (notificationSettings.notifyEmail !== undefined) {
        setSetting(db, 'settings.notifications.notifyEmail', notificationSettings.notifyEmail);
      }
      if (notificationSettings.notifyOnMatchAbove !== undefined) {
        setSetting(db, 'settings.notifications.notifyOnMatchAbove', String(notificationSettings.notifyOnMatchAbove));
      }
      if (notificationSettings.notifyOnDeadlineDays !== undefined) {
        setSetting(db, 'settings.notifications.notifyOnDeadlineDays', String(notificationSettings.notifyOnDeadlineDays));
      }
    }
    if (backupSchedule) {
      if (backupSchedule.intervalHours !== undefined) {
        setSetting(db, 'settings.backup.intervalHours', String(backupSchedule.intervalHours));
      }
      if (backupSchedule.maxBackups !== undefined) {
        setSetting(db, 'settings.backup.maxBackups', String(backupSchedule.maxBackups));
      }
      if (backupSchedule.enabled !== undefined) {
        setSetting(db, 'settings.backup.enabled', String(backupSchedule.enabled));
      }
    }

    const updatedSettings = getSettings(db);
    return NextResponse.json(updatedSettings);
  } catch (error) {
    logger.error({ err: error }, 'Error saving settings');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to save settings'), { status: 500 });
  }
}
