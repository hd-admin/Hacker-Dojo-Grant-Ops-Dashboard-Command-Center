import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const LOG_DIR = path.join(process.cwd(), '.grant-ops-data', 'logs');

const LEVEL_MAP: Record<string, number> = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

const querySchema = z
  .object({
    page: z.preprocess(
      (val) => (val === null || val === undefined ? undefined : Number(val)),
      z.number().int().min(1).optional(),
    ),
    pageSize: z.preprocess(
      (val) => (val === null || val === undefined ? undefined : Number(val)),
      z.number().int().min(1).max(200).optional(),
    ),
    level: z.preprocess(
      (val) => (val === null || val === undefined ? undefined : val),
      z.enum(['debug', 'info', 'warn', 'error']).optional(),
    ),
  })
  .transform((data) => ({
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 50,
    level: data.level,
  }));

export async function GET(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.safeParse({
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
      level: searchParams.get('level'),
    });

    if (!query.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid pagination parameters'),
        { status: 400 },
      );
    }

    const { page, pageSize, level } = query.data;
    const targetLevel = level ? LEVEL_MAP[level] : undefined;

    const logEntries: string[] = [];
    if (fs.existsSync(LOG_DIR)) {
      const files = fs
        .readdirSync(LOG_DIR)
        .filter((f) => f.startsWith('error') && f.endsWith('.log'))
        .sort()
        .reverse()
        .slice(0, 5);
      for (const file of files) {
        const content = fs.readFileSync(path.join(LOG_DIR, file), 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);
        const tail = lines.slice(-500);
        for (const line of tail) {
          if (targetLevel !== undefined) {
            try {
              const parsed = JSON.parse(line) as { level?: number };
              if (parsed.level !== targetLevel) continue;
            } catch {
              // Non-JSON line: skip if filtering by level
              continue;
            }
          }
          logEntries.push(line);
        }
      }
    }

    const totalEntries = logEntries.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const entries = logEntries.slice(start, end);
    const count = entries.length;

    return NextResponse.json({ entries, count, page, pageSize, totalEntries });
  } catch (error) {
    logger.error({ err: error }, 'Error reading error logs');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to read error logs'),
      { status: 500 },
    );
  }
}
