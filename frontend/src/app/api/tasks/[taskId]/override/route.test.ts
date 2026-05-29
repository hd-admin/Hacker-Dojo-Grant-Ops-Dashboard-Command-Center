import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDependencies, resetDependencies, setDependencies } from '@/server/grant-ops/dependencies';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import * as repository from '@/server/grant-ops/repository';
import { POST } from './route';

describe('POST /api/tasks/[taskId]/override', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let taskId: string;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(createDependencies());

    // Create a task to override
    const response = await import('@/app/api/tasks/route').then((m) =>
      m.POST(
        new Request('http://localhost/api/tasks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: 'Review grant proposal', completed: false }),
        }) as never,
      ),
    );
    const created = await response.json();
    taskId = created.id;
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns 404 for nonexistent task', async () => {
    const response = await POST(
      new Request('http://localhost/api/tasks/nonexistent/override', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newValue: 'completed', rationale: 'Manual override', overrideType: 'task' }),
      }) as never,
      { params: Promise.resolve({ taskId: 'nonexistent' }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Task not found/i);
  });

  it('returns 400 for empty rationale', async () => {
    const response = await POST(
      new Request(`http://localhost/api/tasks/${taskId}/override`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newValue: 'completed', rationale: '', overrideType: 'task' }),
      }) as never,
      { params: Promise.resolve({ taskId }) },
    );

    expect(response.status).toBe(400);
  });

  it('returns 400 for missing rationale field', async () => {
    const response = await POST(
      new Request(`http://localhost/api/tasks/${taskId}/override`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newValue: 'completed', overrideType: 'task' }),
      }) as never,
      { params: Promise.resolve({ taskId }) },
    );

    expect(response.status).toBe(400);
  });

  it('overrides task status and creates audit event', async () => {
    const response = await POST(
      new Request(`http://localhost/api/tasks/${taskId}/override`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newValue: 'completed', rationale: 'Manually verified as done', overrideType: 'task' }),
      }) as never,
      { params: Promise.resolve({ taskId }) },
    );
    const updated = await response.json();

    expect(response.status).toBe(200);
    expect(updated.taskStatus).toBe('completed');
    expect(updated.justification).toBe('Manually verified as done');
    expect(updated.completed).toBe(true);

    // Verify audit event was created
    const events = await repository.getAuditEvents();
    expect(events[0]?.eventType).toBe('human_override');
    expect(events[0]?.entityId).toBe(taskId);
    expect(events[0]?.entityType).toBe('task');
    expect(events[0]?.metadata).toMatchObject({
      field: `task.${taskId}.status`,
      newValue: 'completed',
      rationale: 'Manually verified as done',
      overrideType: 'task',
    });
  });

  it('can override task status to waived with rationale', async () => {
    const response = await POST(
      new Request(`http://localhost/api/tasks/${taskId}/override`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newValue: 'waived', rationale: 'Not applicable for this cycle', overrideType: 'task' }),
      }) as never,
      { params: Promise.resolve({ taskId }) },
    );
    const updated = await response.json();

    expect(response.status).toBe(200);
    expect(updated.taskStatus).toBe('waived');
    expect(updated.completed).toBe(false);
    expect(updated.justification).toBe('Not applicable for this cycle');
  });
});
