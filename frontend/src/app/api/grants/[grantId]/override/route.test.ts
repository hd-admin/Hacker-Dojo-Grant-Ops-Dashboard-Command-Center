import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../../../shared/grant-ops-persistence';
import type { Grant, Task } from '../../../../../../../shared/types';
import * as repository from '../../../../../server/grant-ops/repository';
import { POST } from './route';

function createGrant(id: string): Grant {
  return {
    id,
    title: 'Override Me',
    funder: 'Example Foundation',
    funderShort: 'EF',
    award: '$75,000',
    awardSort: 75000,
    deadline: '2026-12-31',
    daysOut: 180,
    fit: 72,
    tags: ['Education'],
    status: 'review',
    statusLabel: 'Review',
    matchedAt: '2026-05-27',
  };
}

function createTask(id: string, grantId?: string): Task {
  return {
    id,
    text: 'Test Task',
    completed: false,
    grantId,
    taskStatus: 'blocked',
  };
}

describe('/api/grants/[grantId]/override route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let grant: Grant;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    grant = createGrant(`grant-${Date.now()}`);
    await repository.addGrant(grant);
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('returns 404 for missing grants', async () => {
    const response = await POST(new Request('http://localhost/api/grants/missing/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field: 'fit', newValue: 85, rationale: 'Manual review', overrideType: 'score' }),
    }) as never, {
      params: Promise.resolve({ grantId: 'missing' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toMatch(/Grant not found/i);
  });

  it('returns 400 for empty rationale', async () => {
    const response = await POST(new Request(`http://localhost/api/grants/${grant.id}/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field: 'fit', newValue: 88, rationale: '', overrideType: 'score' }),
    }) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 400 for missing rationale field', async () => {
    const response = await POST(new Request(`http://localhost/api/grants/${grant.id}/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field: 'fit', newValue: 88, overrideType: 'score' }),
    }) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });

    expect(response.status).toBe(400);
  });

  it('persists human overrides and records an audit event', async () => {
    const response = await POST(new Request(`http://localhost/api/grants/${grant.id}/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field: 'fit', newValue: 88, rationale: 'Board approved manual adjustment', overrideType: 'score' }),
    }) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fit).toBe(88);
    expect(data.humanOverrides).toHaveLength(1);
    expect(data.humanOverrides[0]).toMatchObject({
      field: 'fit',
      previousValue: 72,
      newValue: 88,
      rationale: 'Board approved manual adjustment',
      overrideType: 'score',
    });

    const events = await repository.getAuditEvents();
    expect(events[0]?.eventType).toBe('human_override');
    expect(events[0]?.entityId).toBe(grant.id);
  });

  it('can override status field with human override persisted', async () => {
    const response = await POST(new Request(`http://localhost/api/grants/${grant.id}/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field: 'status', newValue: 'approved', rationale: 'Executive approval confirmed', overrideType: 'status' }),
    }) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('approved');
    expect(data.humanOverrides).toHaveLength(1);
    expect(data.humanOverrides[0].field).toBe('status');
    expect(data.humanOverrides[0].newValue).toBe('approved');
    expect(data.humanOverrides[0].overrideType).toBe('status');
  });

  it('can override task status via task.{taskId}.status field pattern', async () => {
    // Create a task associated with the grant
    const task = createTask('task-123', grant.id);
    const tasks = await repository.getTasks();
    tasks.push(task);
    await repository.updateTasks(tasks);

    const response = await POST(new Request(`http://localhost/api/grants/${grant.id}/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        field: 'task.task-123.status',
        newValue: 'completed',
        rationale: 'Task manually verified by operator',
        overrideType: 'task',
      }),
    }) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    // Verify human override was persisted on the grant
    expect(data.humanOverrides).toHaveLength(1);
    expect(data.humanOverrides[0].field).toBe('task.task-123.status');
    expect(data.humanOverrides[0].newValue).toBe('completed');
    expect(data.humanOverrides[0].rationale).toBe('Task manually verified by operator');
    expect(data.humanOverrides[0].overrideType).toBe('task');

    // Verify audit event was created
    const events = await repository.getAuditEvents();
    expect(events[0]?.eventType).toBe('human_override');
    expect(events[0]?.entityId).toBe(grant.id);
    expect(events[0]?.metadata?.field).toBe('task.task-123.status');

    // Verify task was actually updated
    const updatedTasks = await repository.getTasks();
    const updatedTask = updatedTasks.find((t) => t.id === 'task-123');
    expect(updatedTask?.taskStatus).toBe('completed');
    expect(updatedTask?.justification).toBe('Task manually verified by operator');
  });

  it('returns 404 when overriding a nonexistent task', async () => {
    const response = await POST(new Request(`http://localhost/api/grants/${grant.id}/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        field: 'task.nonexistent-task.status',
        newValue: 'completed',
        rationale: 'Test rationale',
        overrideType: 'task',
      }),
    }) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toMatch(/Task not found/i);
  });

  it('returns 400 for invalid task status value in task override', async () => {
    const task = createTask('task-456', grant.id);
    const tasks = await repository.getTasks();
    tasks.push(task);
    await repository.updateTasks(tasks);

    const response = await POST(new Request(`http://localhost/api/grants/${grant.id}/override`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        field: 'task.task-456.status',
        newValue: 'invalid-status',
        rationale: 'Test rationale',
        overrideType: 'task',
      }),
    }) as never, {
      params: Promise.resolve({ grantId: grant.id }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/Invalid task status/i);
  });
});
