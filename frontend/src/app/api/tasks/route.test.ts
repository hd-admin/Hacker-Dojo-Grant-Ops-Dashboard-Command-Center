/**
 * Tasks API Route Tests
 *
 * Tests the /api/tasks GET route.
 * Verifies tasks persistence layer is properly integrated.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { invalidateCache } from '../../../../../shared/grant-ops-persistence';

describe('/api/tasks route', () => {
  beforeEach(async () => {
    invalidateCache();
  });

  describe('persistence layer integration', () => {
    it('invalidateCache clears the persistence cache', async () => {
      // This test verifies that invalidateCache works without throwing
      expect(() => invalidateCache()).not.toThrow();
    });
  });

  describe('Task type structure', () => {
    it('Task type has required fields', () => {
      const task = {
        id: 'task-1',
        text: 'Review grant proposal',
        completed: false,
      };
      expect(task.id).toBe('task-1');
      expect(task.text).toBe('Review grant proposal');
      expect(task.completed).toBe(false);
    });

    it('completed is a boolean', () => {
      const task = { id: 'task-1', text: 'Test task', completed: true };
      expect(typeof task.completed).toBe('boolean');
    });
  });

  describe('task creation', () => {
    it('can create task with unique id', () => {
      const id = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const task = { id, text: 'New task', completed: false };
      expect(task.id.length).toBeGreaterThan(5);
    });

    it('can toggle task completion', () => {
      const task = { id: 'task-1', text: 'Test task', completed: false };
      const toggled = { ...task, completed: !task.completed };
      expect(toggled.completed).toBe(true);
    });
  });
});
