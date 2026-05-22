import { NextRequest, NextResponse } from 'next/server';
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { Notification } from '../../../../../shared/types';

// GET: Get all notifications
export async function GET() {
  try {
    const deps = getDependencies();
    const notifications = await deps.repository.getNotifications();
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
    const deps = getDependencies();
    const clock = deps.clock;
    const idGenerator = deps.idGenerator;

    const notifications = await deps.repository.getNotifications();

    const newNotification: Notification = {
      id: body.id || idGenerator.generateId('notif'),
      text: body.text,
      time: body.time || clock.now().toISOString(),
      dot: body.dot || 'info',
    };

    notifications.push(newNotification);
    await deps.repository.updateNotifications(notifications);

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
    const deps = getDependencies();

    if (!Array.isArray(body.notifications)) {
      return NextResponse.json({ error: 'Notifications array is required' }, { status: 400 });
    }

    await deps.repository.updateNotifications(body.notifications as Notification[]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
