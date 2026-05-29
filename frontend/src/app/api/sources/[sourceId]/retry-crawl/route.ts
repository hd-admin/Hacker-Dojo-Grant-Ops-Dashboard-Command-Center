import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  try {
    const { sourceId } = await params;
    const deps = getDependencies();

    const source = (await deps.repository.getSources()).find(
      (item) => item.id === sourceId,
    );
    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Update source to queued state
    await deps.repository.updateSource(sourceId, {
      sourceCrawlState: 'queued' as const,
    });

    const now = new Date().toISOString();

    // Create a new crawl run for this source
    const crawlRun = {
      id: deps.idGenerator.generateId('crawl'),
      sourceId,
      startedAt: now,
      status: 'running' as const,
      sourcesCrawled: 1,
      grantsFound: 0,
      grantsMatched: 0,
    };

    await deps.repository.addCrawlRun(crawlRun);

    // Trigger background crawl (fire-and-forget)
    void (async () => {
      try {
        const baseUrl = request.headers.get('origin') ?? 'http://127.0.0.1:3000';
        await fetch(`${baseUrl}/api/crawl`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceIds: [sourceId] }),
        });
      } catch (error) {
        console.error('Error triggering crawl for source', sourceId, error);
      }
    })();

    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'source_retry_crawl',
      entityId: sourceId,
      entityType: 'source',
      actorLabel: 'operator',
      timestamp: now,
      metadata: { crawlRunId: crawlRun.id },
    });

    return NextResponse.json({ success: true, crawlRun });
  } catch (error) {
    console.error('Error retrying crawl for source:', error);
    return NextResponse.json(
      { error: 'Failed to retry crawl' },
      { status: 500 },
    );
  }
}
