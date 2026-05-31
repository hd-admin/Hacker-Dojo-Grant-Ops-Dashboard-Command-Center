import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.join(process.cwd(), '.grant-ops-data', 'logs');

export async function GET(_request: NextRequest) {
  await connection();
  try {
    const logEntries: string[] = [];
    if (fs.existsSync(LOG_DIR)) {
      const files = fs.readdirSync(LOG_DIR)
        .filter((f) => f.startsWith('error') && f.endsWith('.log'))
        .sort()
        .reverse()
        .slice(0, 5);
      for (const file of files) {
        const content = fs.readFileSync(path.join(LOG_DIR, file), 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);
        const tail = lines.slice(-500);
        logEntries.push(...tail);
      }
    }
    return NextResponse.json({ entries: logEntries, count: logEntries.length });
  } catch (error) {
    logger.error({ err: error }, 'Error reading error logs');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to read error logs'), { status: 500 });
  }
}
