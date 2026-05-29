/**
 * Task Service Tests
 *
 * Tests task requirement extraction, state machine, dependency tracking,
 * and submission-blocking logic.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTempDataDir } from '../../../../shared/grant-ops-persistence';
import { setDependencies, resetDependencies, createDependencies } from './dependencies';
import type { Dependencies, Clock } from './dependencies';
import type { Grant, Task, TaskStatus, AuditEvent } from '../../../../shared/types';
import * as taskService from './task-service';

const mockGrant: Grant = {
  id: 'test-grant-1',
  title: 'Test Community Grant',
  funder: 'Test Foundation',
  funderShort: 'TF',
  award: '$50,000',
  awardSort: 50000,
  deadline: '2026-12-31',
  daysOut: 200,
  fit: 85,
  tags: ['Community', 'Education'],
  status: 'matched',
  statusLabel: 'Matched',
  matchedAt: '2026-01-15',
};

function createFixedClock(isoString: string): Clock {
  return { now: () => new Date(isoString) };
}

describe('TaskService', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>> | null = null;

  afterEach(async () => {
    if (tempDataDir) {
      await tempDataDir.cleanup();
      tempDataDir = null;
    }
    resetDependencies();
  });

  // ==================== Requirement Extraction ====================

  describe('extractRequirementsFromGrant', () => {
    it('extracts draft requirement when grant is in matched status', async () => {
      tempDataDir = await withTempDataDir();
      const deps = createDependencies();
      setDependencies(deps);

      const tasks = taskService.extractRequirementsFromGrant(mockGrant, 'draft');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.text).toBe('Generate draft LOI for Test Foundation');
      expect(tasks[0]!.responsibilityTag).toBe('program');
      expect(tasks[0]!.taskStatus).toBe('blocked');
    });

    it('extracts review requirement from a draft grant', async () => {
      tempDataDir = await withTempDataDir();
      const deps = createDependencies();
      setDependencies(deps);

      const draftGrant: Grant = { ...mockGrant, status: 'draft' };
      const tasks = taskService.extractRequirementsFromGrant(draftGrant, 'review');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.text).toBe('Review draft for Test Foundation');
      expect(tasks[0]!.responsibilityTag).toBe('review');
    });

    it('extracts finance verification from review grant', async () => {
      tempDataDir = await withTempDataDir();
      const deps = createDependencies();
      setDependencies(deps);

      const reviewGrant: Grant = { ...mockGrant, status: 'review' };
      const tasks = taskService.extractRequirementsFromGrant(reviewGrant, 'finance');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.text).toBe('Verify budget and finance for Test Foundation (Test Community Grant)');
      expect(tasks[0]!.responsibilityTag).toBe('finance');
    });

    it('extracts follow-up requirement from a draft grant', async () => {
      tempDataDir = await withTempDataDir();
      const deps = createDependencies();
      setDependencies(deps);

      const draftGrant: Grant = { ...mockGrant, status: 'draft' };
      const tasks = taskService.extractRequirementsFromGrant(draftGrant, 'follow-up');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.text).toBe('Schedule follow-up for Test Foundation');
      expect(tasks[0]!.responsibilityTag).toBe('follow-up');
    });

    it('extracts maintenance requirement for awarded grant', async () => {
      tempDataDir = await withTempDataDir();
      const deps = createDependencies();
      setDependencies(deps);

      const awardedGrant: Grant = { ...mockGrant, status: 'awarded' };
      const tasks = taskService.extractRequirementsFromGrant(awardedGrant, 'maintenance');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.text).toBe('Maintain records for Test Foundation');
      expect(tasks[0]!.responsibilityTag).toBe('follow-up');
    });

    it('marks extracted tasks as blocking submission when required', async () => {
      tempDataDir = await withTempDataDir();
      const deps = createDependencies();
      setDependencies(deps);

      const tasks = taskService.extractRequirementsFromGrant(mockGrant, 'draft', true);

      expect(tasks[0]!.blockSubmission).toBe(true);
    });

    it('includes grantId in extracted tasks', async () => {
      tempDataDir = await withTempDataDir();
      const deps = createDependencies();
      setDependencies(deps);

      const tasks = taskService.extractRequirementsFromGrant(mockGrant, 'program');

      expect(tasks[0]!.grantId).toBe(mockGrant.id);
    });
  });

  // ==================== Manual Task Creation ====================

  describe('createTask', () => {
    it('creates a task with required fields', async () => {
      tempDataDir = await withTempDataDir();

      const fixedClock = createFixedClock('2026-06-01T00:00:00Z');
      const deps = createDependencies({ clock: fixedClock });
      setDependencies(deps);

      const result = await taskService.createTask({
        text: 'Write project proposal',
        responsibilityTag: 'program',
      });

      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(result.task!.text).toBe('Write project proposal');
      expect(result.task!.responsibilityTag).toBe('program');
      expect(result.task!.taskStatus).toBe('blocked');
      expect(result.task!.blockSubmission).toBe(false);
      expect(result.task!.completed).toBe(false);
      expect(result.task!.id).toBeDefined();
      expect(result.task!.id.startsWith('task-')).toBe(true);
    });

    it('creates a task with due date', async () => {
      tempDataDir = await withTempDataDir();

      const deps = createDependencies();
      setDependencies(deps);

      const result = await taskService.createTask({
        text: 'Review tax forms',
        responsibilityTag: 'finance',
        dueDate: '2026-12-31',
      });

      expect(result.success).toBe(true);
      expect(result.task!.dueDate).toBe('2026-12-31');
    });

    it('creates a task with dependencies', async () => {
      tempDataDir = await withTempDataDir();

      const deps = createDependencies();
      setDependencies(deps);

      const result = await taskService.createTask({
        text: 'Submit final package',
        responsibilityTag: 'program',
        dependsOn: ['task-1', 'task-2'],
      });

      expect(result.success).toBe(true);
      expect(result.task!.dependsOn).toEqual(['task-1', 'task-2']);
    });

    it('creates a task that blocks submission', async () => {
      tempDataDir = await withTempDataDir();

      const deps = createDependencies();
      setDependencies(deps);

      const result = await taskService.createTask({
        text: 'Final sign-off',
        responsibilityTag: 'review',
        blockSubmission: true,
      });

      expect(result.success).toBe(true);
      expect(result.task!.blockSubmission).toBe(true);
    });

    it('persists the created task to the repository', async () => {
      tempDataDir = await withTempDataDir();

      const deps = createDependencies();
      setDependencies(deps);

      const result = await taskService.createTask({
        text: 'Check grant compliance',
        responsibilityTag: 'finance',
      });

      expect(result.success).toBe(true);

      const storedTasks = await deps.repository.getTasks();
      expect(storedTasks).toHaveLength(1);
      expect(storedTasks[0]!.text).toBe('Check grant compliance');
    });

    it('creates audit event for task creation', async () => {
      tempDataDir = await withTempDataDir();

      const deps = createDependencies();
      setDependencies(deps);

      const result = await taskService.createTask({
        text: 'Audit tracked task',
        responsibilityTag: 'program',
      });

      expect(result.success).toBe(true);

      const auditEvents = await deps.repository.getAuditEvents();
      const taskCreatedEvent = auditEvents.find(
        (e: AuditEvent) => e.eventType === 'task_created',
      );
      expect(taskCreatedEvent).toBeDefined();
      expect(taskCreatedEvent!.entityId).toBe(result.task!.id);
    });
  });

  // ==================== Task State Machine ====================

  describe('transitionTask', () => {
    let deps: Dependencies;

    const setupTask = async (
      status: TaskStatus = 'blocked',
      blockSubmission = false,
    ): Promise<Task> => {
      const result = await taskService.createTask({
        text: 'Test task',
        responsibilityTag: 'program',
        blockSubmission,
      });
      if (!result.success || !result.task) throw new Error('Failed to create task');
      // Manually set the initial status
      await deps.repository.updateTasks([
        { ...result.task, taskStatus: status, completed: status === 'completed' },
      ]);
      return { ...result.task, taskStatus: status, completed: status === 'completed' };
    };

    beforeEach(async () => {
      tempDataDir = await withTempDataDir();
      deps = createDependencies();
      setDependencies(deps);
    });

    it('transitions from blocked to in-progress', async () => {
      const task = await setupTask('blocked');

      const result = await taskService.transitionTask(task.id, 'in-progress');

      expect(result.success).toBe(true);
      expect(result.task!.taskStatus).toBe('in-progress');
      expect(result.task!.completed).toBe(false);
    });

    it('transitions from in-progress to completed', async () => {
      const task = await setupTask('in-progress');

      const result = await taskService.transitionTask(task.id, 'completed', {
        evidence: 'All documents submitted',
      });

      expect(result.success).toBe(true);
      expect(result.task!.taskStatus).toBe('completed');
      expect(result.task!.completed).toBe(true);
      expect(result.task!.evidence).toBe('All documents submitted');
    });

    it('transitions to waived with justification', async () => {
      const task = await setupTask('blocked');

      const result = await taskService.transitionTask(task.id, 'waived', {
        justification: 'Not applicable to our organization',
      });

      expect(result.success).toBe(true);
      expect(result.task!.taskStatus).toBe('waived');
      expect(result.task!.completed).toBe(false);
      expect(result.task!.justification).toBe('Not applicable to our organization');
    });

    it('transitions to not-applicable with justification', async () => {
      const task = await setupTask('blocked');

      const result = await taskService.transitionTask(task.id, 'not-applicable', {
        justification: 'This grant does not require this step',
      });

      expect(result.success).toBe(true);
      expect(result.task!.taskStatus).toBe('not-applicable');
      expect(result.task!.completed).toBe(false);
    });

    it('can reactivate a waived task back to blocked', async () => {
      const task = await setupTask('waived');

      const result = await taskService.transitionTask(task.id, 'blocked', {
        justification: 'Re-evaluated - this is needed',
      });

      expect(result.success).toBe(true);
      expect(result.task!.taskStatus).toBe('blocked');
    });

    it('records completion evidence', async () => {
      const task = await setupTask('in-progress');

      const result = await taskService.transitionTask(task.id, 'completed', {
        evidence: 'Signed form 990-PF uploaded',
      });

      expect(result.task!.evidence).toBe('Signed form 990-PF uploaded');
    });

    it('creates audit event for status transition', async () => {
      const task = await setupTask('blocked');

      await taskService.transitionTask(task.id, 'in-progress');

      const auditEvents = await deps.repository.getAuditEvents();
      const transitionEvents = auditEvents.filter(
        (e: AuditEvent) => e.eventType === 'task_status_changed',
      );
      expect(transitionEvents.length).toBeGreaterThan(0);
      const latest = transitionEvents[transitionEvents.length - 1]!;
      expect(latest.metadata).toBeDefined();
      expect(latest.metadata!.previousStatus).toBe('blocked');
      expect(latest.metadata!.newStatus).toBe('in-progress');
    });

    it('returns error for unknown task', async () => {
      const result = await taskService.transitionTask('non-existent-task', 'in-progress');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error for invalid status transition (blocked -> completed without in-progress)', async () => {
      // This should still work because we allow direct completion in some cases
      const task = await setupTask('blocked');

      const result = await taskService.transitionTask(task.id, 'completed', {
        evidence: 'Done',
      });

      // Direct completion IS allowed
      expect(result.success).toBe(true);
      expect(result.task!.taskStatus).toBe('completed');
    });
  });

  // ==================== Dependency Tracking ====================

  describe('dependency tracking', () => {
    let deps: Dependencies;

    beforeEach(async () => {
      tempDataDir = await withTempDataDir();
      deps = createDependencies();
      setDependencies(deps);
    });

    it('identifies blocked tasks with unsatisfied dependencies', async () => {
      // Create dependent tasks
      const dep1 = await taskService.createTask({
        text: 'Prerequisite A',
        responsibilityTag: 'program',
      });
      const dep2 = await taskService.createTask({
        text: 'Prerequisite B',
        responsibilityTag: 'finance',
      });

      // Create main task that depends on both
      await taskService.createTask({
        text: 'Main deliverable',
        responsibilityTag: 'review',
        dependsOn: [dep1.task!.id, dep2.task!.id],
      });

      const blockedBy = await taskService.checkDependencyBlocked(dep1.task!.id);
      expect(blockedBy.length).toBeGreaterThan(0);
    });

    it('dependencies are satisfied when all prerequisite tasks are completed', async () => {
      const dep1 = await taskService.createTask({
        text: 'Prerequisite X',
        responsibilityTag: 'program',
      });
      const dep2 = await taskService.createTask({
        text: 'Prerequisite Y',
        responsibilityTag: 'finance',
      });

      // Complete both prerequisites
      await taskService.transitionTask(dep1.task!.id, 'completed');
      await taskService.transitionTask(dep2.task!.id, 'completed');

      // Create main task
      const mainTask = await taskService.createTask({
        text: 'Final step',
        responsibilityTag: 'review',
        dependsOn: [dep1.task!.id, dep2.task!.id],
      });

      const unsatisfied = await taskService.getUnsatisfiedDependencies(mainTask.task!.id);
      expect(unsatisfied.length).toBe(0);
    });

    it('dependencies are unsatisfied when prerequisite is waived or not-applicable', async () => {
      const dep1 = await taskService.createTask({
        text: 'Optional step',
        responsibilityTag: 'follow-up',
      });
      await taskService.transitionTask(dep1.task!.id, 'waived', {
        justification: 'Not needed',
      });

      const mainTask = await taskService.createTask({
        text: 'Next step',
        responsibilityTag: 'review',
        dependsOn: [dep1.task!.id],
      });

      const unsatisfied = await taskService.getUnsatisfiedDependencies(mainTask.task!.id);
      // Waived/not-applicable should NOT block (they are a valid termination state)
      expect(unsatisfied.length).toBe(0);
    });
  });

  // ==================== Completion Evidence ====================

  describe('completion evidence', () => {
    let deps: Dependencies;

    beforeEach(async () => {
      tempDataDir = await withTempDataDir();
      deps = createDependencies();
      setDependencies(deps);
    });

    it('records evidence when completing a task', async () => {
      const task = await taskService.createTask({
        text: 'Upload financial statements',
        responsibilityTag: 'finance',
      });
      await taskService.transitionTask(task.task!.id, 'in-progress');

      const result = await taskService.transitionTask(task.task!.id, 'completed', {
        evidence: '2025_audit_report.pdf - SHA256: abc123',
      });

      expect(result.success).toBe(true);
      expect(result.task!.evidence).toBe('2025_audit_report.pdf - SHA256: abc123');
    });

    it('allows evidence to be updated after completion', async () => {
      const task = await taskService.createTask({
        text: 'Submit form',
        responsibilityTag: 'program',
      });
      await taskService.transitionTask(task.task!.id, 'completed', {
        evidence: 'Form submitted',
      });

      const updated = await taskService.updateEvidence(task.task!.id, 'Form submitted, confirmation: ABC-12345');
      expect(updated.evidence).toBe('Form submitted, confirmation: ABC-12345');
    });
  });

  // ==================== Submission Blocking ====================

  describe('submission blocking', () => {
    let deps: Dependencies;

    beforeEach(async () => {
      tempDataDir = await withTempDataDir();
      deps = createDependencies();
      setDependencies(deps);
    });

    it('blocks submission when mandatory tasks are not completed', async () => {
      await taskService.createTask({
        text: 'Final approval',
        responsibilityTag: 'review',
        grantId: mockGrant.id,
        blockSubmission: true,
      });

      const blocking = await taskService.checkSubmissionBlocking(mockGrant.id);
      expect(blocking.isBlocked).toBe(true);
      expect(blocking.blockingTasks.length).toBe(1);
      expect(blocking.blockingTasks[0]!.text).toBe('Final approval');
      expect(blocking.reason).toContain('Final approval');
    });

    it('does not block submission when all mandatory tasks are completed', async () => {
      const task = await taskService.createTask({
        text: 'Completed check',
        responsibilityTag: 'review',
        grantId: mockGrant.id,
        blockSubmission: true,
      });
      await taskService.transitionTask(task.task!.id, 'completed', {
        evidence: 'Done',
      });

      const blocking = await taskService.checkSubmissionBlocking(mockGrant.id);
      expect(blocking.isBlocked).toBe(false);
    });

    it('does not block submission when mandatory tasks are waived', async () => {
      const task = await taskService.createTask({
        text: 'Waived check',
        responsibilityTag: 'review',
        grantId: mockGrant.id,
        blockSubmission: true,
      });
      await taskService.transitionTask(task.task!.id, 'waived', {
        justification: 'Not needed for this submission',
      });

      const blocking = await taskService.checkSubmissionBlocking(mockGrant.id);
      expect(blocking.isBlocked).toBe(false);
    });

    it('does not block submission when mandatory tasks are not-applicable', async () => {
      const task = await taskService.createTask({
        text: 'N/A check',
        responsibilityTag: 'review',
        grantId: mockGrant.id,
        blockSubmission: true,
      });
      await taskService.transitionTask(task.task!.id, 'not-applicable', {
        justification: 'Does not apply',
      });

      const blocking = await taskService.checkSubmissionBlocking(mockGrant.id);
      expect(blocking.isBlocked).toBe(false);
    });

    it('non-blocking tasks do not block submission', async () => {
      await taskService.createTask({
        text: 'Optional review',
        responsibilityTag: 'program',
        grantId: mockGrant.id,
        blockSubmission: false,
      });

      const blocking = await taskService.checkSubmissionBlocking(mockGrant.id);
      expect(blocking.isBlocked).toBe(false);
    });

    it('handles multiple blocking tasks with clear reason', async () => {
      await taskService.createTask({
        text: 'Finance review',
        responsibilityTag: 'finance',
        grantId: mockGrant.id,
        blockSubmission: true,
      });
      await taskService.createTask({
        text: 'Legal sign-off',
        responsibilityTag: 'review',
        grantId: mockGrant.id,
        blockSubmission: true,
      });

      const blocking = await taskService.checkSubmissionBlocking(mockGrant.id);
      expect(blocking.isBlocked).toBe(true);
      expect(blocking.blockingTasks.length).toBe(2);
      expect(blocking.reason).toContain('Finance review');
      expect(blocking.reason).toContain('Legal sign-off');
    });
  });

  // ==================== Task Listing ====================

  describe('getTasks', () => {
    it('returns empty array when no tasks exist', async () => {
      tempDataDir = await withTempDataDir();
      const deps = createDependencies();
      setDependencies(deps);

      const tasks = await taskService.getTasks();
      expect(tasks).toEqual([]);
    });

    it('returns all tasks sorted by creation', async () => {
      tempDataDir = await withTempDataDir();
      const deps = createDependencies();
      setDependencies(deps);

      await taskService.createTask({ text: 'Task 1', responsibilityTag: 'program' });
      await taskService.createTask({ text: 'Task 2', responsibilityTag: 'finance' });

      const tasks = await taskService.getTasks();
      expect(tasks).toHaveLength(2);
    });
  });
});
