import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { Task } from '../../../../../shared/types';
export const dynamic = 'force-dynamic';


// GET: Get all tasks
export async function GET() {
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
  try {
    const body = await request.json();
    const deps = getDependencies();
    const idGenerator = deps.idGenerator;

    const tasks = await deps.repository.getTasks();

    const newTask: Task = {
      id: body.id || idGenerator.generateId('task'),
      text: body.text,
      completed: body.completed || false,
    };

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
