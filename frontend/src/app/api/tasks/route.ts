import { NextResponse } from 'next/server';
import * as repository from '@/server/grant-ops/repository';

export async function GET() {
  try {
    const tasks = await repository.getTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error getting tasks:', error);
    return NextResponse.json({ error: 'Failed to get tasks' }, { status: 500 });
  }
}
