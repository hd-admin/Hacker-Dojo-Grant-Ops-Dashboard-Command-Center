import { NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const bodySchema = z.object({
  name: z.string().min(1),
});

interface GrantOpsDb {
  prepare(sql: string): { get(key: string): { value: string } | undefined; run(key: string, value: string): void };
}

interface GrantOpsGlobal {
  __grantOpsDb?: GrantOpsDb;
}

export const dynamic = 'force-dynamic';

const OPERATOR_NAME_KEY = 'operator.name';

function getDb(): GrantOpsDb | undefined {
  return (globalThis as unknown as GrantOpsGlobal).__grantOpsDb;
}

export async function GET() {
  await connection();
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ name: '' });
    }
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(OPERATOR_NAME_KEY);
    return NextResponse.json({ name: row?.value || '' });
  } catch (error) {
    logger.error({ err: error }, 'Error reading operator name');
    return NextResponse.json({ name: '' });
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('OPERATOR_NAME_REQUIRED', 'Operator name is required'), { status: 400 });
    }
    const name = parsed.data.name.trim();
    const db = getDb();
    if (!db) {
      return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Database not available'), { status: 500 });
    }
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(OPERATOR_NAME_KEY, name);
    return NextResponse.json({ name });
  } catch (error) {
    logger.error({ err: error }, 'Error saving operator name');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to save operator name'), { status: 500 });
  }
}
