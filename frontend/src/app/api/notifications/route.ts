import { NextRequest, NextResponse, connection } from 'next/server';
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from '@/server/grant-ops/dependencies';
import { sanitizeNotificationText } from '@/lib/sanitize-html';
import type { Notification } from '../../../../../shared/types';
import { z } from 'zod';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  time: z.string().optional(),
  dot: z.enum(['info', 'accent', 'success', 'warning', 'danger']).optional(),
});

// GET: Get all notifications
export async function GET(): Promise<NextResponse> {
  await connection();
  try {
    const deps = getDependencies();
    const notifications = await deps.repository.getNotifications();
    return NextResponse.json(notifications);
  } catch (error) {
    logger.error({ err: error }, 'Error getting notifications');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get notifications'),
      { status: 500 },
    );
  }
}

// POST: Add a new notification
export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const rawBody = await request.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', 'Invalid request body'), {
        status: 400,
      });
    }
    const body = parsed.data;
    const deps = getDependencies();
    const clock = deps.clock;
    const idGenerator = deps.idGenerator;

    const notifications = await deps.repository.getNotifications();

    const newNotification: Notification = {
      id: body.id || idGenerator.generateId('notif'),
      text: sanitizeNotificationText(body.text ?? ''),
      time: body.time || clock.now().toISOString(),
      dot: body.dot || 'info',
    };

    notifications.push(newNotification);
    await deps.repository.updateNotifications(notifications);

    return NextResponse.json(newNotification, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Error creating notification');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to create notification'),
      { status: 500 },
    );
  }
}

const notificationItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  time: z.string(),
  dot: z.enum(['info', 'accent', 'success', 'warning', 'danger']),
  urgency: z.enum(['info', 'warning', 'urgent']).optional(),
});

const patchBodySchema = z.object({
  notifications: z.array(notificationItemSchema),
});

// PATCH: Batch update notifications (replace all notifications)
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  await connection();
  try {
    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse('AGENT_INVALID_JSON', 'Invalid notifications array'),
        { status: 400 },
      );
    }

    const deps = getDependencies();
    const sanitized: Notification[] = parsed.data.notifications.map((n) => {
      const notification: Notification = {
        id: n.id,
        text: sanitizeNotificationText(n.text),
        time: n.time,
        dot: n.dot,
      };
      if (n.urgency !== undefined) {
        notification.urgency = n.urgency;
      }
      return notification;
    });
    await deps.repository.updateNotifications(sanitized);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Error updating notifications');
    return NextResponse.json(
      createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to update notifications'),
      { status: 500 },
    );
  }
}
