'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import type { Notification } from '../../../shared/types';
import { notificationsApi } from '../lib/grant-ops-client';
import { sanitizeNotificationText } from '../lib/sanitize-html';

interface NotificationsViewProps {
  notifications?: Notification[];
}

export default function NotificationsView({ notifications: notificationsProp }: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<Notification[]>(notificationsProp ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (notificationsProp) {
      setNotifications(notificationsProp);
      return;
    }

    async function load() {
      try {
        const data = await notificationsApi.getAll();
        setNotifications(data);
      } catch (error) {
        console.error('Error loading notifications:', error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [notificationsProp]);

  if (loading) {
    return <div className="header-title" role="status" aria-busy="true" aria-label="Loading notifications">Loading...</div>;
  }

  if (notifications.length === 0) {
    return (
      <>
        <div className="header">
          <div>
            <h1 className="header-title">
              Notifications <span className="accent">Activity</span>
            </h1>
            <div className="header-sub">No notifications</div>
          </div>
        </div>
        <div className="empty-state-guide" data-testid="notifications-empty-state">
          <div className="empty-state-icon" aria-hidden="true">{String.fromCodePoint(0x1F514)}</div>
          <div className="empty-state-title">No notifications yet</div>
          <div className="empty-state-description">
            Activity appears here as grants are discovered, drafted, and submitted.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            Notifications <span className="accent">Activity</span>
          </h1>
          <div className="header-sub">{notifications.length} notifications</div>
        </div>
      </div>
      <div className="notifications-list">
        {notifications.map((notification) => (
          <div key={notification.id} className="notification-item">
            <div className={`notification-dot ${notification.dot}`} />
            <div className="notification-content">
              <div className="notification-text" dangerouslySetInnerHTML={{ __html: sanitizeNotificationText(notification.text) }} />
              <div className="notification-time">{notification.time}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
