import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDependencies, resetDependencies, setDependencies } from '@/server/grant-ops/dependencies';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import { GET, PATCH, POST } from './route';

describe('/api/follow-ups route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(createDependencies());
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('GET returns an empty array when no follow-ups exist', async () => {
    const response = await GET();
    const followUps = await response.json();

    expect(response.status).toBe(200);
    expect(followUps).toEqual([]);
  });

  it('POST rejects missing id/title', async () => {
    const response = await POST(
      new Request('http://localhost/api/follow-ups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Missing id' }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/ID and title are required/i);
  });

  it('POST creates a follow-up and GET reads it back', async () => {
    const response = await POST(
      new Request('http://localhost/api/follow-ups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'followup-1',
          grantId: 'grant-1',
          type: 'progress_check',
          title: 'Check in with funder',
          description: 'Follow up on the application status',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      }) as never,
    );
    const created = await response.json();

    expect(response.status).toBe(201);
    expect(created.id).toBe('followup-1');
    expect(created.grantId).toBe('grant-1');

    const getResponse = await GET();
    const followUps = await getResponse.json();
    expect(followUps).toHaveLength(1);
    expect(followUps[0]?.title).toBe('Check in with funder');
  });

  it('PATCH rejects missing id and updates persisted follow-up fields', async () => {
    const missingIdResponse = await PATCH(
      new Request('http://localhost/api/follow-ups', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'No id' }),
      }) as never,
    );
    const missingIdData = await missingIdResponse.json();

    expect(missingIdResponse.status).toBe(400);
    expect(missingIdData.error).toMatch(/ID is required/i);

    await POST(
      new Request('http://localhost/api/follow-ups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'followup-2',
          grantId: 'grant-2',
          type: 'report_due',
          title: 'Submit progress report',
        }),
      }) as never,
    );

    const response = await PATCH(
      new Request('http://localhost/api/follow-ups', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'followup-2',
          grantId: 'grant-2',
          type: 'report_due',
          title: 'Submit progress report',
          status: 'completed',
          completedAt: new Date().toISOString(),
        }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const getResponse = await GET();
    const followUps = await getResponse.json();
    expect(followUps[0]?.status).toBe('completed');
    expect(followUps[0]?.completedAt).toBeDefined();
  });
});
