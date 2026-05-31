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
    const { readSnippets, getSqliteState } = await import('../../../../../shared/grant-ops-sqlite');
    const snippets = readSnippets(getSqliteState(), grantId ?? undefined);
    return NextResponse.json({ snippets });
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
      grantId: parsed.data.grantId ?? null,
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      createdAt: new Date().toISOString(),
    };
    const { writeSnippet, getSqliteState } = await import('../../../../../shared/grant-ops-sqlite');
    writeSnippet(getSqliteState(), snippet);
    return NextResponse.json({ snippet }, { status: 201 });
  } catch (error) {
    console.error('Error creating snippet:', error);
    return NextResponse.json({ error: 'Failed to create snippet' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    const parsed = snippetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid snippet payload', details: parsed.error.format() }, { status: 400 });
    }
    const deps = getDependencies();
    const rawBody = await request.json().catch(() => null) as { id?: string } | null;
    const snippet = {
      id: rawBody?.id || deps.idGenerator.generateId('snippet'),
      grantId: parsed.data.grantId ?? null,
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      createdAt: new Date().toISOString(),
    };
    const { writeSnippet, getSqliteState } = await import('../../../../../shared/grant-ops-sqlite');
    writeSnippet(getSqliteState(), snippet);
    return NextResponse.json({ snippet });
  } catch (error) {
    console.error('Error updating snippet:', error);
    return NextResponse.json({ error: 'Failed to update snippet' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Snippet ID is required' }, { status: 400 });
    }
    const { deleteSnippet, getSqliteState } = await import('../../../../../shared/grant-ops-sqlite');
    deleteSnippet(getSqliteState(), id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting snippet:', error);
    return NextResponse.json({ error: 'Failed to delete snippet' }, { status: 500 });
  }
}
