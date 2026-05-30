import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach } from 'vitest';
import { POST } from './route';
import { resetSafetyService } from '@/server/grant-ops/safety-service';

function createRequest(body?: unknown): NextRequest {
  const url = 'http://localhost:3000/api/safety/lock';
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('/api/safety/lock route', () => {
  beforeEach(() => {
    resetSafetyService();
  });

  it('POST with valid passcode returns 200 with locked: true', async () => {
    const req = createRequest({ passcode: '123456' });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.locked).toBe(true);
  });

  it('POST without passcode returns 400', async () => {
    const req = createRequest({});
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('passcode is required');
  });

  it('POST with empty passcode returns 400', async () => {
    const req = createRequest({ passcode: '' });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('POST when already locked returns 200 with message', async () => {
    const req1 = createRequest({ passcode: 'abc123' });
    await POST(req1);
    const req2 = createRequest({ passcode: 'def456' });
    const response = await POST(req2);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.locked).toBe(true);
    expect(body.message).toBe('App is already locked');
  });
});
