import { NextResponse } from 'next/server';
import * as repository from '@/server/grant-ops/repository';

export async function GET() {
  try {
    const notifications = await repository.getNotifications();
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error getting notifications:', error);
    return NextResponse.json({ error: 'Failed to get notifications' }, { status: 500 });
  }
}
