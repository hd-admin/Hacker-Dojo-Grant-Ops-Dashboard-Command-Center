import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDependencies, resetDependencies, setDependencies } from '@/server/grant-ops/dependencies';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import { GET, PATCH, POST } from './route';

describe('/api/tasks route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(createDependencies());
    await PATCH(
      new Request('http://localhost/api/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tasks: [] }),
      }) as never,
    );
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('GET returns an empty array when no tasks exist', async () => {
    const response = await GET();
    const tasks = await response.json();

    expect(response.status).toBe(200);
    expect(tasks).toEqual([]);
  });

  it('POST rejects missing text', async () => {
    const response = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Text is required/i);
  });

  it('POST creates a task and GET reads it back', async () => {
    const response = await POST(
      new Request('http://localhost/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Review grant proposal', completed: false }),
      }) as never,
    );
    const created = await response.json();

    expect(response.status).toBe(201);
    expect(created.text).toBe('Review grant proposal');
    expect(created.completed).toBe(false);

    const getResponse = await GET();
    const tasks = await getResponse.json();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.text).toBe('Review grant proposal');
  });

  it('PATCH replaces persisted tasks and rejects non-array payloads', async () => {
    const badResponse = await PATCH(
      new Request('http://localhost/api/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tasks: null }),
      }) as never,
    );
    const badData = await badResponse.json();

    expect(badResponse.status).toBe(400);
    expect(badData.error).toMatch(/Tasks array is required/i);

    const response = await PATCH(
      new Request('http://localhost/api/tasks', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tasks: [
            { id: 'task-1', text: 'Draft proposal', completed: false },
            { id: 'task-2', text: 'Follow up with review committee', completed: true },
          ],
        }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const getResponse = await GET();
    const tasks = await getResponse.json();
    expect(tasks).toHaveLength(2);
    expect(tasks[1]?.completed).toBe(true);
  });
});
