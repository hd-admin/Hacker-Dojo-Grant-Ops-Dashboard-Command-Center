import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const patternSchema = z.object({
  funderName: z.string().min(1),
  patternType: z.string().min(1),
  confidence: z.number().min(0).max(100),
  evidence: z.string().min(1),
});

export async function POST(req: NextRequest) {
  await connection();
  try {
    const body = await req.json();
    const parsed = patternSchema.parse(body);
    // Store as activity event or return directly
    return NextResponse.json({
      pattern: {
        id: crypto.randomUUID(),
        ...parsed,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Invalid input' } },
      { status: 400 }
    );
  }
}

export async function GET(_req: NextRequest) {
  await connection();
  return NextResponse.json({ patterns: [] });
}
