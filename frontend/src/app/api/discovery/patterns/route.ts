import { connection } from 'next/server';
import { logger } from '@/lib/logger';
import { createErrorResponse } from '@/lib/api-error-handler';
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
  } catch (error) {
    return NextResponse.json(
      createErrorResponse('AGENT_SCHEMA_MISMATCH', error instanceof Error ? error.message : 'Invalid input'),
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
  } catch (error) {
    logger.error({ err: error }, 'Error getting patterns');
    return NextResponse.json(
      createErrorResponse('DB_INTEGRITY_ERROR', 'Failed to get patterns'),
      { status: 500 }
    );
  }
}
