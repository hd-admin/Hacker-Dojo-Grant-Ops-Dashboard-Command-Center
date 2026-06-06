import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { Task, TaskStatus, ResponsibilityTag } from '../../../../../shared/types';
import { z } from 'zod';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  completed: z.boolean().optional(),
  taskStatus: z
    .enum(['blocked', 'in-progress', 'completed', 'waived', 'not-applicable'])
    .optional(),
  responsibilityTag: z.enum(['finance', 'program', 'review', 'follow-up']).optional(),
  dependsOn: z.array(z.string()).optional(),
  justification: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  evidence: z.string().optional(),
  blockSubmission: z.boolean().optional(),
});

const patchBodySchema = z.object({
  tasks: z.array(bodySchema),
});

// GET: Get all tasks
export async function GET(): Promise<NextResponse> {
  await connection();
  try {
    const deps = getDependencies();
    const tasks = await deps.repository.getTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    logger.error({ err: error }, 'Error getting tasks');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get tasks'), {
      status: 500,
    });
  }
}

// POST: Add a new task
export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const rawBody = await request.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Text is required'), {
        status: 400,
      });
    }
    const body = parsed.data;
    const deps = getDependencies();
    const idGenerator = deps.idGenerator;

    const tasks = await deps.repository.getTasks();

    const VALID_TASK_STATUSES: TaskStatus[] = [
      'blocked',
      'in-progress',
      'completed',
      'waived',
      'not-applicable',
    ];
    const VALID_RESPONSIBILITY_TAGS: ResponsibilityTag[] = [
      'finance',
      'program',
      'review',
      'follow-up',
    ];

    const newTask: Task = {
      id: body.id || idGenerator.generateId('task'),
      text: body.text.trim(),
      completed: Boolean(body.completed),
    };

    if (body.taskStatus !== undefined && VALID_TASK_STATUSES.includes(body.taskStatus)) {
      newTask.taskStatus = body.taskStatus;
    }
    if (
      body.responsibilityTag !== undefined &&
      VALID_RESPONSIBILITY_TAGS.includes(body.responsibilityTag)
    ) {
      newTask.responsibilityTag = body.responsibilityTag;
    }
    if (Array.isArray(body.dependsOn)) {
      newTask.dependsOn = body.dependsOn.filter((d: unknown): d is string => typeof d === 'string');
    }
    if (typeof body.justification === 'string') {
      newTask.justification = body.justification;
    }
    if (typeof body.dueDate === 'string') {
      newTask.dueDate = body.dueDate;
    }
    if (typeof body.notes === 'string') {
      newTask.notes = body.notes;
    }
    if (typeof body.evidence === 'string') {
      newTask.evidence = body.evidence;
    }
    if (body.blockSubmission === true) {
      newTask.blockSubmission = true;
    }

    tasks.push(newTask);
    await deps.repository.updateTasks(tasks);

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error creating task');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create task'), {
      status: 500,
    });
  }
}

// PATCH: Batch update tasks (replace all tasks)
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('AGENT_INVALID_JSON', 'Invalid tasks array'),
        { status: 400 },
      );
    }

    const deps = getDependencies();
    const validTasks: Task[] = parsed.data.tasks.map((t) => {
      const task: Task = {
        id: t.id || deps.idGenerator.generateId('task'),
        text: t.text.trim(),
        completed: Boolean(t.completed),
      };
      if (t.taskStatus !== undefined) task.taskStatus = t.taskStatus;
      if (t.responsibilityTag !== undefined) task.responsibilityTag = t.responsibilityTag;
      if (Array.isArray(t.dependsOn)) task.dependsOn = t.dependsOn;
      if (t.justification !== undefined) task.justification = t.justification;
      if (t.dueDate !== undefined) task.dueDate = t.dueDate;
      if (t.notes !== undefined) task.notes = t.notes;
      if (t.evidence !== undefined) task.evidence = t.evidence;
      if (t.blockSubmission === true) task.blockSubmission = true;
      return task;
    });
    await deps.repository.updateTasks(validTasks);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error updating tasks');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to update tasks'), {
      status: 500,
    });
  }
}
