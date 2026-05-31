import { connection } from 'next/server';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';

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
    const deps = getDependencies();

    const pattern = {
      id: deps.idGenerator.generateId('pattern'),
      ...parsed,
      createdAt: new Date().toISOString(),
    };

    // Store as activity event
    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'pattern_detected',
      entityId: pattern.id,
      entityType: 'pattern',
      actorLabel: 'agent',
      timestamp: pattern.createdAt,
      metadata: pattern,
    });

    return NextResponse.json({ pattern });
  } catch (_error) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Invalid input' } },
      { status: 400 }
    );
  }
}

export async function GET(_req: NextRequest) {
  await connection();
  try {
    const deps = getDependencies();
    const events = await deps.repository.getAuditEvents?.(100) ?? [];
    const patterns = events
      .filter((e) => e.eventType === 'pattern_detected')
      .map((e) => ({
        id: String(e.metadata?.id ?? e.id),
        funderName: String(e.metadata?.funderName ?? ''),
        patternType: String(e.metadata?.patternType ?? ''),
        confidence: Number(e.metadata?.confidence ?? 0),
        evidence: String(e.metadata?.evidence ?? ''),
        createdAt: e.timestamp,
      }));
    return NextResponse.json({ patterns });
  } catch (_error) {
    logger.error({ err: error }, 'Error getting patterns');
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Failed to get patterns' } }, { status: 500 });
  }
}
