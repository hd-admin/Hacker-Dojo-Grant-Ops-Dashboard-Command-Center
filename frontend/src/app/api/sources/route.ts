import { NextRequest, NextResponse, connection } from 'next/server';
import * as sourceService from '@/server/grant-ops/source-service';

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
    console.error('Error getting sources:', error);
    return NextResponse.json({ error: 'Failed to get sources' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || typeof body.url !== 'string') {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
    }

    const sourceInput: Parameters<typeof sourceService.addSource>[0] = {
      name: body.name.trim(),
      url: body.url.trim(),
      type: body.type === 'database' || body.type === 'api' ? body.type : 'website',
      reviewStatus: body.reviewStatus === 'approved' ? 'approved' : 'pending-review',
    };
    if (typeof body.suggestedBy === 'string') sourceInput.suggestedBy = body.suggestedBy;
    if (typeof body.suggestionReason === 'string') sourceInput.suggestionReason = body.suggestionReason;
    if (body.category === 'foundation' || body.category === 'government' || body.category === 'corporate' || body.category === 'community' || body.category === 'other') sourceInput.category = body.category;
    if (typeof body.categoryRationale === 'string') sourceInput.categoryRationale = body.categoryRationale;
    if (body.crawlAccessCategory === 'crawlable' || body.crawlAccessCategory === 'manual-only' || body.crawlAccessCategory === 'unsupported') sourceInput.crawlAccessCategory = body.crawlAccessCategory;
    const source = await sourceService.addSource(sourceInput);

    return NextResponse.json({ success: true, source }, { status: 201 });
  } catch (error) {
    console.error('Error adding source:', error);
    return NextResponse.json({ error: 'Failed to add source' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    await sourceService.removeSource(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing source:', error);
    return NextResponse.json({ error: 'Failed to remove source' }, { status: 500 });
  }
}
