import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import * as sourceService from '@/server/grant-ops/source-service';
import { z } from 'zod';

const bodySchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  type: z.enum(['database', 'api', 'website']).optional(),
  reviewStatus: z.enum(['approved', 'pending-review']).optional(),
  suggestedBy: z.string().optional(),
  suggestionReason: z.string().optional(),
  category: z.enum(['foundation', 'government', 'corporate', 'community', 'other']).optional(),
  categoryRationale: z.string().optional(),
  crawlAccessCategory: z.enum(['crawlable', 'manual-only', 'unsupported']).optional(),
});

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');
    const sourceId = searchParams.get('sourceId');

    // If sourceId is provided, return crawl history for that source
    if (sourceId) {
      const history = await sourceService.getSourceCrawlHistory(sourceId);
      return NextResponse.json(history);
    }

    const sources = await sourceService.getAllSources();

    // Enrich sources with crawl state
    const enriched = await Promise.all(
      sources.map((source) => sourceService.enrichSourceWithCrawlState(source)),
    );

    const filtered = filter === 'pending-review'
      ? enriched.filter((source) => source.reviewStatus === 'pending-review')
      : enriched;
    return NextResponse.json(filtered);
  } catch (error) {
    logger.error({ err: error }, 'Error getting sources');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get sources'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Name and URL are required'), { status: 400 });
    }
    const body = parsed.data;

    const sourceInput: Parameters<typeof sourceService.addSource>[0] = {
      name: body.name.trim(),
      url: body.url.trim(),
      type: body.type ?? 'website',
      reviewStatus: body.reviewStatus ?? 'pending-review',
    };
    if (body.suggestedBy) sourceInput.suggestedBy = body.suggestedBy;
    if (body.suggestionReason) sourceInput.suggestionReason = body.suggestionReason;
    if (body.category) sourceInput.category = body.category;
    if (body.categoryRationale) sourceInput.categoryRationale = body.categoryRationale;
    if (body.crawlAccessCategory) sourceInput.crawlAccessCategory = body.crawlAccessCategory;
    const source = await sourceService.addSource(sourceInput);

    return NextResponse.json({ success: true, source }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error adding source');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to add source'), { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Source ID is required'), { status: 400 });
    }

    await sourceService.removeSource(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error removing source');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to remove source'), { status: 500 });
  }
}
