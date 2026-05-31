import { NextRequest, NextResponse, connection } from "next/server";
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { Task } from '../../../../../../../shared/types';

export const dynamic = 'force-dynamic';

const VALID_TASK_STATUSES = ['blocked', 'in-progress', 'completed', 'waived', 'not-applicable'] as const;

const bodySchema = z.object({
  newValue: z.enum(VALID_TASK_STATUSES),
  rationale: z.string().min(1, 'Rationale is required'),
  overrideType: z.literal('task'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  await connection();
  try {
    const { taskId } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid override payload', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { newValue, rationale, overrideType } = parsed.data;
    const deps = getDependencies();

    // Load all tasks and find the target
    const tasks = await deps.repository.getTasks();
    const taskIndex = tasks.findIndex((t) => t.id === taskId);

    if (taskIndex === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const existingTask = tasks[taskIndex];
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const previousValue = existingTask.taskStatus ?? (existingTask.completed ? 'completed' : 'blocked');

    // Update the task with override values
    const updatedTask: Task = {
      ...existingTask,
      taskStatus: newValue,
      justification: rationale,
      completed: newValue === 'completed',
    };

    // Persist the updated task
    tasks[taskIndex] = updatedTask;
    await deps.repository.updateTasks(tasks);

    // Create audit event for the human override
    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'human_override',
      entityId: taskId,
      entityType: 'task',
      actorLabel: 'operator',
      timestamp: new Date().toISOString(),
      metadata: {
        field: `task.${taskId}.status`,
        previousValue,
        newValue,
        rationale,
        overrideType,
      },
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error overriding task:', error);
    return NextResponse.json({ error: 'Failed to override task' }, { status: 500 });
  }
}
