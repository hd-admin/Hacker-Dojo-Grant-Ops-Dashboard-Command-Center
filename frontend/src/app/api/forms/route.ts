import { connection } from 'next/server';
import { logger } from '@/lib/logger';
import { createErrorResponse } from '@/lib/api-error-handler';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  funderId: z.string().nullable().optional(),
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
  try {
    const deps = getDependencies();
    const forms = await deps.repository.getFormTemplates?.() ?? [];
    return NextResponse.json({ forms });
  } catch (error) {
    logger.error({ err: error }, 'Error getting forms');
    return NextResponse.json(
      createErrorResponse('DB_INTEGRITY_ERROR', 'Failed to get forms'),
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  await connection();
  try {
    const body = await req.json();
    const parsed = formSchema.parse(body);
    const deps = getDependencies();
    const form = {
      id: parsed.id || deps.idGenerator.generateId('form'),
      name: parsed.name,
      funderId: parsed.funderId ?? null,
      fields: parsed.fields,
      createdAt: parsed.createdAt || new Date().toISOString(),
    };
    await deps.repository.createFormTemplate?.(form);
    return NextResponse.json({ form });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse('AGENT_SCHEMA_MISMATCH', error instanceof Error ? error.message : 'Invalid input'),
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  await connection();
  try {
    const body = await req.json();
    const parsed = formSchema.parse(body);
    if (!parsed.id) {
      return NextResponse.json({ error: { code: 'MISSING_ID', message: 'Form ID is required' } }, { status: 400 });
    }
    const deps = getDependencies();
    const form = {
      id: parsed.id,
      name: parsed.name,
      funderId: parsed.funderId ?? null,
      fields: parsed.fields,
      createdAt: parsed.createdAt || new Date().toISOString(),
    };
    await deps.repository.createFormTemplate?.(form);
    return NextResponse.json({ form: { ...form, updatedAt: new Date().toISOString() } });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse('AGENT_SCHEMA_MISMATCH', error instanceof Error ? error.message : 'Invalid input'),
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: { code: 'MISSING_ID', message: 'Form ID is required' } }, { status: 400 });
    }
    const { deleteFormTemplate, getSqliteState } = await import('../../../../../shared/grant-ops-sqlite');
    deleteFormTemplate(getSqliteState(), id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting form');
    return NextResponse.json(
      createErrorResponse('DB_INTEGRITY_ERROR', 'Failed to delete form'),
      { status: 500 }
    );
  }
}
