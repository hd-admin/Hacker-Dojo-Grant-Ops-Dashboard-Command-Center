import { NextRequest, NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

const snippetSchema = z.object({
  grantId: z.string().optional(),
  title: z.string().min(1),
  content: z.string().default(''),
  category: z.string().default(''),
});

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get('grantId');
    const deps = getDependencies();
    const snippets = (await deps.repository.getSnippets?.() ?? []) as unknown as Record<string, unknown>[];
    const filtered = grantId ? snippets.filter((s) => s.grantId === grantId) : snippets;
    return NextResponse.json({ snippets: filtered });
  } catch (error) {
    console.error('Error getting snippets:', error);
    return NextResponse.json({ error: 'Failed to get snippets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    const parsed = snippetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid snippet payload', details: parsed.error.format() }, { status: 400 });
    }
    const deps = getDependencies();
    const snippet = {
      id: deps.idGenerator.generateId('snippet'),
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };
    await deps.repository.createSnippet?.(snippet);
    return NextResponse.json({ snippet }, { status: 201 });
  } catch (error) {
    console.error('Error creating snippet:', error);
    return NextResponse.json({ error: 'Failed to create snippet' }, { status: 500 });
  }
}
