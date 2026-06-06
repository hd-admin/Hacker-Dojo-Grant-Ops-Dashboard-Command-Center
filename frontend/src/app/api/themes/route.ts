import { type NextRequest, NextResponse, connection } from 'next/server';
import { revalidateAfterMutation } from '@/lib/revalidate';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { loadThemesData, saveThemesData } from '../../../../../shared/grant-ops-persistence';
import type { ThemesData } from '../../../../../shared/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const keywordClusterSchema = z.object({
  id: z.string(),
  name: z.string(),
  keywords: z.array(z.string()),
  weight: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const regionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const populationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const strategicPrioritySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  weight: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const themeSchema = z.object({
  keywordClusters: z.array(keywordClusterSchema).optional(),
  themes: z
    .array(
      z.object({
        name: z.string().min(1),
        keywords: z.array(z.string()).optional(),
        matchingPolicy: z.object({
          matchThreshold: z.number().min(0).max(100),
          autoDraftThreshold: z.number().min(0).max(100),
        }),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .optional(),
  regions: z.array(regionSchema).optional(),
  populations: z.array(populationSchema).optional(),
  strategicPriorities: z.array(strategicPrioritySchema).optional(),
});

const DEFAULT_THEMES: ThemesData = {
  keywordClusters: [],
  themes: [],
  regions: [],
  populations: [],
  strategicPriorities: [],
};

export async function GET(): Promise<NextResponse> {
  await connection();
  try {
    const data = await loadThemesData().catch(() => DEFAULT_THEMES);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(DEFAULT_THEMES);
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const raw = await request.json().catch(() => null);
    const parsed = themeSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          'AGENT_INVALID_JSON',
          `Invalid themes data: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        ),
        { status: 400 },
      );
    }
    const body = parsed.data as ThemesData;
    await saveThemesData(body);
    revalidateAfterMutation();
    const saved = await loadThemesData();
    return NextResponse.json(saved);
  } catch (error) {
    logger.error({ err: error }, '[themes] PUT failed');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to save themes'), {
      status: 500,
    });
  }
}
