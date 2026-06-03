import { type NextRequest, NextResponse, connection } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { loadThemesData, saveThemesData } from '../../../../../shared/grant-ops-persistence';
import type { ThemesData } from '../../../../../shared/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const themeSchema = z.object({
  keywordClusters: z.array(z.any()).optional(),
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
  regions: z.array(z.any()).optional(),
  populations: z.array(z.any()).optional(),
  strategicPriorities: z.array(z.any()).optional(),
});

const DEFAULT_THEMES: ThemesData = {
  keywordClusters: [],
  themes: [],
  regions: [],
  populations: [],
  strategicPriorities: [],
};

export async function GET() {
  await connection();
  try {
    const data = await loadThemesData().catch(() => DEFAULT_THEMES);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(DEFAULT_THEMES);
  }
}

export async function PUT(request: NextRequest) {
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
    revalidatePath('/api/themes');
    revalidatePath('/');
    const saved = await loadThemesData();
    return NextResponse.json(saved);
  } catch (error) {
    logger.error({ err: error }, '[themes] PUT failed');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to save themes'), {
      status: 500,
    });
  }
}
