import { NextResponse, connection } from "next/server";
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveDataDir } from '../../../../../shared/grant-ops-sqlite';

export const dynamic = 'force-dynamic';

function getOperatorPath(): string {
  return path.join(resolveDataDir(), 'operator.json');
}

export async function GET() {
  await connection();
  try {
    const opPath = getOperatorPath();
    const data = await fs.readFile(opPath, 'utf8').catch(() => null);
    if (data) {
      const parsed = JSON.parse(data);
      return NextResponse.json({ name: parsed.name || '' });
    }
    return NextResponse.json({ name: '' });
  } catch {
    return NextResponse.json({ name: '' });
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    const name = (body?.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Operator name is required' }, { status: 400 });
    }
    const opPath = getOperatorPath();
    await fs.mkdir(path.dirname(opPath), { recursive: true });
    await fs.writeFile(opPath, JSON.stringify({ name, updatedAt: new Date().toISOString() }), 'utf8');
    return NextResponse.json({ name });
  } catch (error) {
    console.error('Error saving operator name:', error);
    return NextResponse.json({ error: 'Failed to save operator name' }, { status: 500 });
  }
}
