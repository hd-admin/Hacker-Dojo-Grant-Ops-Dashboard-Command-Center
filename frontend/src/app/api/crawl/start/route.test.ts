import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('/api/crawl/start', () => {
  it('queues a crawl job and returns 202 with jobId', async () => {
    const request = new Request('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceId: 'source-test' }),
    });

    const response = await POST(request as unknown as import('next/server').NextRequest);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.jobId).toMatch(/^crawl-/);
    expect(body.sourceId).toBe('source-test');
    expect(body.message).toBe('Crawl job queued');
  });

  it('accepts empty body and still returns 202', async () => {
    const request = new Request('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request as unknown as import('next/server').NextRequest);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.jobId).toMatch(/^crawl-/);
    expect(body.sourceId).toBeUndefined();
  });

  it('returns 202 for invalid request body by falling back to empty object', async () => {
    const request = new Request('http://localhost:3000/api/crawl/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });

    const response = await POST(request as unknown as import('next/server').NextRequest);
    const body = await response.json();
    expect(response.status).toBe(202);
    expect(body.jobId).toMatch(/^crawl-/);
  });
});
