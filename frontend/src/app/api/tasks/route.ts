import { NextRequest, NextResponse, connection } from "next/server";
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { Task, TaskStatus, ResponsibilityTag } from '../../../../../shared/types';
export const dynamic = 'force-dynamic';

// GET: Get all tasks
export async function GET() {
  await connection();
  try {
    const deps = getDependencies();
    const tasks = await deps.repository.getTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error getting tasks:', error);
    return NextResponse.json({ error: 'Failed to get tasks' }, { status: 500 });
  }
}

// POST: Add a new task
export async function POST(request: NextRequest) {
  await connection();
  try {
    const body = await request.json();
    const deps = getDependencies();
    const idGenerator = deps.idGenerator;

    if (typeof body.text !== 'string' || !body.text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const tasks = await deps.repository.getTasks();

    const VALID_TASK_STATUSES: TaskStatus[] = ['blocked', 'in-progress', 'completed', 'waived', 'not-applicable'];
    const VALID_RESPONSIBILITY_TAGS: ResponsibilityTag[] = ['finance', 'program', 'review', 'follow-up'];

    const newTask: Task = {
      id: body.id || idGenerator.generateId('task'),
      text: body.text.trim(),
      completed: Boolean(body.completed),
    };

    if (body.taskStatus !== undefined && VALID_TASK_STATUSES.includes(body.taskStatus)) {
      newTask.taskStatus = body.taskStatus;
    }
    if (body.responsibilityTag !== undefined && VALID_RESPONSIBILITY_TAGS.includes(body.responsibilityTag)) {
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
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// PATCH: Batch update tasks (replace all tasks)
export async function PATCH(request: NextRequest) {
  await connection();
  try {
    const body = await request.json();
    const deps = getDependencies();

    if (!Array.isArray(body.tasks)) {
      return NextResponse.json({ error: 'Tasks array is required' }, { status: 400 });
    }

    await deps.repository.updateTasks(body.tasks as Task[]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating tasks:', error);
    return NextResponse.json({ error: 'Failed to update tasks' }, { status: 500 });
  }
}
