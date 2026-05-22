import { NextRequest, NextResponse } from 'next/server';
import * as repository from '@/server/grant-ops/repository';
import type { Notification } from '../../../../../shared/types';

// GET: Get all notifications
export async function GET() {
  try {
    const notifications = await repository.getNotifications();
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error getting notifications:', error);
    return NextResponse.json({ error: 'Failed to get notifications' }, { status: 500 });
  }
}

// POST: Add a new notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const notifications = await repository.getNotifications();

    const newNotification: Notification = {
      id: body.id || `notif-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
      text: body.text,
      time: body.time || 'now',
      dot: body.dot || 'info',
    };

    notifications.push(newNotification);
    await repository.updateNotifications(notifications);

    return NextResponse.json(newNotification, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

// PATCH: Batch update notifications (replace all notifications)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!Array.isArray(body.notifications)) {
      return NextResponse.json({ error: 'Notifications array is required' }, { status: 400 });
    }

    await repository.updateNotifications(body.notifications as Notification[]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
