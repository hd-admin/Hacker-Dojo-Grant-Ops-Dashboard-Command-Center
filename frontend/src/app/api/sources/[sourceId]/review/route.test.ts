import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { Source } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { POST } from './route';

function createSource(id: string): Source {
  return {
    id,
    name: 'Pending Source',
    url: 'https://example.org/pending-source',
    type: 'website',
    createdAt: '2026-05-27T00:00:00.000Z',
    isActive: false,
    reviewStatus: 'pending-review',
    suggestedBy: 'ai',
    suggestionReason: 'Suggested for testing',
    sourceCrawlState: 'never-crawled',
    crawlAccessCategory: 'crawlable',
  };
}

describe('/api/sources/[sourceId]/review route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let source: Source;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    source = createSource(`source-${Date.now()}`);
    await repository.addSource(source);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('approves a pending source and records an audit event', async () => {
    const response = await POST(new Request(`http://localhost/api/sources/${source.id}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', category: 'foundation', categoryRationale: 'Operator confirmed fit' }),
    }) as never, {
      params: Promise.resolve({ sourceId: source.id }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reviewStatus).toBe('approved');
    expect(data.approvedAt).toBeTruthy();
    expect(data.isActive).toBe(true);
    expect(data.category).toBe('foundation');

    const events = await repository.getAuditEvents();
    expect(events[0]?.eventType).toBe('source_review_actioned');
    expect(events[0]?.metadata).toMatchObject({ action: 'approve', category: 'foundation' });
  });

  it('rejects a source and persists the rejection reason', async () => {
    const response = await POST(new Request(`http://localhost/api/sources/${source.id}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason: 'Not relevant to the org mission' }),
    }) as never, {
      params: Promise.resolve({ sourceId: source.id }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reviewStatus).toBe('rejected');
    expect(data.rejectionReason).toBe('Not relevant to the org mission');
    expect(data.isActive).toBe(false);
  });

  it('categorizes a source without changing its review status', async () => {
    const response = await POST(new Request(`http://localhost/api/sources/${source.id}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'categorize', category: 'community', categoryRationale: 'Local partnerships' }),
    }) as never, {
      params: Promise.resolve({ sourceId: source.id }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reviewStatus).toBe('pending-review');
    expect(data.category).toBe('community');
    expect(data.categoryRationale).toBe('Local partnerships');
  });
});
