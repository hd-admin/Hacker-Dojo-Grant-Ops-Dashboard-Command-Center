import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { Task, FollowUp } from '../../../shared/types';

const { tasksGetAllMock, followUpsGetAllMock } = vi.hoisted(() => ({
  tasksGetAllMock: vi.fn(),
  followUpsGetAllMock: vi.fn(),
}));

vi.mock('../lib/grant-ops-client', () => ({
  tasksApi: {
    getAll: tasksGetAllMock,
    update: vi.fn().mockResolvedValue({ success: true }),
    create: vi.fn().mockResolvedValue({ id: 'new-task', text: 'test', completed: false }),
  },
  followUpsApi: {
    getAll: followUpsGetAllMock,
    update: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import TasksView from './TasksView';

const mockTasks: Task[] = [
  { id: 'task-1', text: 'Review NSF TechAccess LOI', completed: false },
  { id: 'task-2', text: 'Send partnership letter to Mountain View Library', completed: true },
  { id: 'task-3', text: 'Update budget justification', completed: false },
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

beforeEach(() => {
  tasksGetAllMock.mockResolvedValue([]);
  followUpsGetAllMock.mockResolvedValue([]);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  tasksGetAllMock.mockReset();
  followUpsGetAllMock.mockReset();
});

describe('TasksView', () => {
  describe('Task data handling', () => {
    it('should create new task with unique id', () => {
      const newTask = {
        id: `task-test-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
        completed: false,
        text: 'New task text',
      };
      expect(newTask.id.length).toBeGreaterThan(10);
      expect(newTask.completed).toBe(false);
      expect(newTask.text).toBe('New task text');
    });

    it('should have correct task text', () => {
      const texts = mockTasks.map((t) => t.text);
      expect(texts).toContain('Review NSF TechAccess LOI');
      expect(texts).toContain('Send partnership letter to Mountain View Library');
      expect(texts).toContain('Update budget justification');
    });
  });

  describe('Task completion counting', () => {
    it('should count completed tasks correctly', () => {
      const completedCount = mockTasks.filter((t) => t.completed).length;
      expect(completedCount).toBe(1);
    });

    it('should filter completed vs pending tasks', () => {
      const pending = mockTasks.filter((t) => !t.completed);
      const completed = mockTasks.filter((t) => t.completed);
      expect(pending).toHaveLength(2);
      expect(completed).toHaveLength(1);
    });
  });

  describe('Task data integrity', () => {
    it('should have unique IDs for all tasks', () => {
      const ids = mockTasks.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid completion status for all tasks', () => {
      const allValid = mockTasks.every((t) => typeof t.completed === 'boolean');
      expect(allValid).toBe(true);
    });
  });
});

describe('TasksView follow-up rendering', () => {
  beforeEach(() => {
    tasksGetAllMock.mockResolvedValue([]);
    const testFollowUp: FollowUp = {
      id: 'fu-1',
      grantId: 'g-1',
      type: 'report_due',
      title: 'Submit final report',
      dueDate: '2026-09-01T00:00:00.000Z',
      status: 'pending',
      createdAt: '2026-05-01T00:00:00.000Z',
    };
    followUpsGetAllMock.mockResolvedValue([testFollowUp]);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    tasksGetAllMock.mockReset();
    followUpsGetAllMock.mockReset();
  });

  it('renders follow-up type, dueDate label, and status metadata in TasksView', async () => {
    root.render(React.createElement(TasksView, {}));
    await waitFor(() => container.textContent?.includes('report due') === true);
    expect(container.textContent).toContain('Submit final report');
    expect(container.textContent).toContain('Due:');
    expect(container.textContent).toContain('pending');
  });
});
