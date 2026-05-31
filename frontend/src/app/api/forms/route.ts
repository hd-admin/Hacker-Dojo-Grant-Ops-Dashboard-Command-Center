import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  fields: z.array(z.object({
    label: z.string(),
    type: z.string(),
    required: z.boolean().default(false),
  })).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export async function GET(_req: NextRequest) {
  await connection();
  return NextResponse.json({ forms: [] });
}

export async function POST(req: NextRequest) {
  await connection();
  try {
    const body = await req.json();
    const parsed = formSchema.parse(body);
    return NextResponse.json({ form: { ...parsed, id: parsed.id || crypto.randomUUID(), createdAt: new Date().toISOString() } });
  } catch (error) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Invalid input' } }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  await connection();
  try {
    const body = await req.json();
    const parsed = formSchema.parse(body);
    return NextResponse.json({ form: { ...parsed, updatedAt: new Date().toISOString() } });
  } catch (error) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Invalid input' } }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  await connection();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: { code: 'MISSING_ID', message: 'Form ID is required' } }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
