/**
 * Task Service
 *
 * Handles task management for grant operations:
 * - Requirement extraction from grants
 * - Manual task creation with responsibility tags
 * - Task state machine (blocked/in_progress/completed/waived/not_applicable)
 * - Due dates support
 * - Dependency tracking (dependsOn)
 * - Completion evidence
 * - Submission-blocking: mandatory tasks must be completed before submission-ready
 */

import type { Grant, Task, TaskStatus } from '../../../../shared/types';
import { getDependencies } from './dependencies';

// ==================== Types ====================

export interface CreateTaskInput {
  text: string;
  responsibilityTag: 'finance' | 'program' | 'review' | 'follow-up';
  grantId?: string;
  taskStatus?: TaskStatus;
  dependsOn?: string[];
  dueDate?: string;
  notes?: string;
  blockSubmission?: boolean;
}

export interface CreateTaskResult {
  success: boolean;
  task?: Task;
  error?: string;
}

export interface TransitionTaskInput {
  evidence?: string;
  justification?: string;
}

export interface TransitionTaskResult {
  success: boolean;
  task?: Task;
  error?: string;
}

export interface SubmissionBlockingResult {
  isBlocked: boolean;
  blockingTasks: Task[];
  reason?: string;
}

export type RequirementPhase = 'draft' | 'review' | 'finance' | 'follow-up' | 'maintenance' | 'program';

// ==================== Requirement Extraction ====================

const REQUIREMENT_TEMPLATES: Record<RequirementPhase, {
  textTemplate: (funder: string, title: string) => string;
  responsibilityTag: 'finance' | 'program' | 'review' | 'follow-up';
}> = {
  draft: {
    textTemplate: (funder) => `Generate draft LOI for ${funder}`,
    responsibilityTag: 'program',
  },
  review: {
    textTemplate: (funder) => `Review draft for ${funder}`,
    responsibilityTag: 'review',
  },
  finance: {
    textTemplate: (funder, title) => `Verify budget and finance for ${funder} (${title})`,
    responsibilityTag: 'finance',
  },
  'follow-up': {
    textTemplate: (funder) => `Schedule follow-up for ${funder}`,
    responsibilityTag: 'follow-up',
  },
  maintenance: {
    textTemplate: (funder) => `Maintain records for ${funder}`,
    responsibilityTag: 'follow-up',
  },
  program: {
    textTemplate: (funder) => `Program evaluation for ${funder}`,
    responsibilityTag: 'program',
  },
};

/**
 * Extract task requirements from a grant based on phase.
 * These are auto-generated tasks that track what needs to happen for each grant.
 */
export function extractRequirementsFromGrant(
  grant: Grant,
  phase: RequirementPhase,
  blockSubmission = false,
): Partial<Task>[] {
  const template = REQUIREMENT_TEMPLATES[phase];
  if (!template) return [];

  const deps = getDependencies();
  const idGenerator = deps.idGenerator;

  const task: Partial<Task> = {
    id: idGenerator.generateId('task'),
    text: template.textTemplate(grant.funder, grant.title),
    completed: false,
    grantId: grant.id,
    taskStatus: 'blocked' as TaskStatus,
    responsibilityTag: template.responsibilityTag,
    blockSubmission,
    dependsOn: [],
  };

  return [task];
}

// ==================== Task Creation ====================

/**
 * Create a manual task with responsibility tags and optional properties.
 */
export async function createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
  try {
    const deps = getDependencies();
    const idGenerator = deps.idGenerator;
    const clock = deps.clock;

    if (!input.text.trim()) {
      return { success: false, error: 'Task text is required' };
    }

    const task: Task = {
      id: idGenerator.generateId('task'),
      text: input.text.trim(),
      completed: false,
      grantId: input.grantId,
      taskStatus: input.taskStatus ?? 'blocked',
      responsibilityTag: input.responsibilityTag,
      dependsOn: input.dependsOn ?? [],
      dueDate: input.dueDate,
      notes: input.notes,
      blockSubmission: input.blockSubmission ?? false,
    };

    const tasks = await deps.repository.getTasks();
    tasks.push(task);
    await deps.repository.updateTasks(tasks);

    // Create audit event
    await deps.repository.addAuditEvent({
      id: idGenerator.generateId('audit'),
      eventType: 'task_created',
      entityId: task.id,
      entityType: 'task',
      actorLabel: 'operator',
      timestamp: clock.now().toISOString(),
      metadata: {
        text: task.text,
        responsibilityTag: task.responsibilityTag,
        grantId: task.grantId,
        blockSubmission: task.blockSubmission,
      },
    });

    return { success: true, task };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// ==================== Task State Machine ====================

const VALID_STATUSES: TaskStatus[] = ['blocked', 'in-progress', 'completed', 'waived', 'not-applicable'];

/**
 * Transition a task to a new status.
 * Supports evidence recording for completions and justification for waiving.
 */
export async function transitionTask(
  taskId: string,
  newStatus: TaskStatus,
  input?: TransitionTaskInput,
): Promise<TransitionTaskResult> {
  try {
    const deps = getDependencies();
    const clock = deps.clock;

    if (!VALID_STATUSES.includes(newStatus)) {
      return { success: false, error: `Invalid status: ${newStatus}` };
    }

    const tasks = await deps.repository.getTasks();
    const taskIndex = tasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      return { success: false, error: 'Task not found' };
    }

    const existingTask = tasks[taskIndex]!;
    const previousStatus = existingTask.taskStatus ?? 'blocked';

    const updatedTask: Task = {
      ...existingTask,
      taskStatus: newStatus,
      completed: newStatus === 'completed',
    };

    // Record evidence for completion
    if (input?.evidence) {
      updatedTask.evidence = input.evidence;
    }

    // Record justification for waived/not-applicable
    if (input?.justification) {
      updatedTask.justification = input.justification;
    }

    tasks[taskIndex] = updatedTask;
    await deps.repository.updateTasks(tasks);

    // Create audit event for status transition
    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'task_status_changed',
      entityId: taskId,
      entityType: 'task',
      actorLabel: 'operator',
      timestamp: clock.now().toISOString(),
      metadata: {
        previousStatus,
        newStatus,
        evidence: input?.evidence,
        justification: input?.justification,
      },
    });

    return { success: true, task: updatedTask };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// ==================== Completion Evidence ====================

/**
 * Update the evidence for a task without changing its status.
 */
export async function updateEvidence(taskId: string, evidence: string): Promise<Task> {
  const deps = getDependencies();
  const tasks = await deps.repository.getTasks();
  const taskIndex = tasks.findIndex((t) => t.id === taskId);

  if (taskIndex === -1) {
    throw new Error('Task not found');
  }

  const updatedTask: Task = {
    ...tasks[taskIndex]!,
    evidence,
  };

  tasks[taskIndex] = updatedTask;
  await deps.repository.updateTasks(tasks);

  return updatedTask;
}

// ==================== Dependency Tracking ====================

/**
 * Check which tasks are blocked by the given prerequisite task being incomplete.
 * Returns tasks whose dependsOn list includes the prerequisite task.
 */
export async function checkDependencyBlocked(prerequisiteTaskId: string): Promise<Task[]> {
  const deps = getDependencies();
  const tasks = await deps.repository.getTasks();
  return tasks.filter((t) =>
    Array.isArray(t.dependsOn) && t.dependsOn.includes(prerequisiteTaskId),
  );
}

/**
 * Get unsatisfied dependencies for a task.
 * A dependency is satisfied if it is completed, waived, or not-applicable.
 */
export async function getUnsatisfiedDependencies(taskId: string): Promise<Task[]> {
  const deps = getDependencies();
  const tasks = await deps.repository.getTasks();
  const currentTask = tasks.find((t) => t.id === taskId);

  if (!currentTask || !Array.isArray(currentTask.dependsOn)) {
    return [];
  }

  const dependencyIds = currentTask.dependsOn;
  const dependencies = tasks.filter((t) => dependencyIds.includes(t.id));

  // A dependency is satisfied if it is 'completed', 'waived', or 'not-applicable'
  const satisfiedStatuses: TaskStatus[] = ['completed', 'waived', 'not-applicable'];
  return dependencies.filter((dep) => !satisfiedStatuses.includes(dep.taskStatus ?? 'blocked'));
}

// ==================== Submission Blocking ====================

// Statuses that do NOT block submission (task is resolved)
const NON_BLOCKING_STATUSES: TaskStatus[] = ['completed', 'waived', 'not-applicable'];

/**
 * Check if a grant's submission is blocked by incomplete mandatory tasks.
 * Only tasks with blockSubmission=true AND not in a non-blocking state count.
 */
export async function checkSubmissionBlocking(grantId: string): Promise<SubmissionBlockingResult> {
  const deps = getDependencies();
  const tasks = await deps.repository.getTasks();

  const blockingTasks = tasks.filter(
    (t) =>
      t.grantId === grantId &&
      t.blockSubmission === true &&
      !NON_BLOCKING_STATUSES.includes(t.taskStatus ?? 'blocked'),
  );

  if (blockingTasks.length === 0) {
    return { isBlocked: false, blockingTasks: [] };
  }

  const taskNames = blockingTasks.map((t) => t.text).join(', ');

  return {
    isBlocked: true,
    blockingTasks,
    reason: `The following mandatory tasks must be completed before submission: ${taskNames}`,
  };
}

// ==================== Task Listing ====================

/**
 * Get all tasks from the repository.
 */
export async function getTasks(): Promise<Task[]> {
  const deps = getDependencies();
  return deps.repository.getTasks();
}

/**
 * Get tasks for a specific grant.
 */
export async function getTasksForGrant(grantId: string): Promise<Task[]> {
  const deps = getDependencies();
  const tasks = await deps.repository.getTasks();
  return tasks.filter((t) => t.grantId === grantId);
}
