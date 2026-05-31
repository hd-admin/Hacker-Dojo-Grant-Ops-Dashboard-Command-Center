'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import type { Notification } from '../../../shared/types';
import { notificationsApi } from '../lib/grant-ops-client';
import { sanitizeNotificationText } from '../lib/sanitize-html';

interface NotificationsViewProps {
  notifications?: Notification[];
}

type UrgencyFilter = 'all' | 'urgent' | 'warning' | 'info';

function getUrgencyDotClass(urgency?: 'info' | 'warning' | 'urgent', dot?: string): string {
  if (urgency === 'urgent') return 'notification-dot urgent';
  if (urgency === 'warning') return 'notification-dot warning';
  if (urgency === 'info') return 'notification-dot info';
  return `notification-dot ${dot || 'info'}`;
}

export function NotificationsView({ notifications: notificationsProp }: NotificationsViewProps) {
  const [notifications, setNotifications] = useState<Notification[]>(notificationsProp ?? []);
  const [loading, setLoading] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [_error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (notificationsProp) {
      setNotifications(notificationsProp);
      return;
    }

    async function load() {
      try {
        const data = await notificationsApi.getAll();
        setNotifications(data);
      } catch (_error) {
        setError('Error loading notifications');
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

  const filteredNotifications = urgencyFilter === 'all'
    ? notifications
    : notifications.filter((n) => n.urgency === urgencyFilter);

  const urgentCount = notifications.filter((n) => n.urgency === 'urgent').length;

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            Notifications <span className="accent">Activity</span>
          </h1>
          <div className="header-sub">
            {urgentCount > 0 ? `${urgentCount} urgent, ` : ''}{notifications.length} total
          </div>
        </div>
      </div>
      <div className="filter-bar" data-testid="notifications-urgency-filter-bar">
        {(['all', 'urgent', 'warning', 'info'] as const).map((level) => (
          <button
            key={level}
            type="button"
            className={`filter-pill ${urgencyFilter === level ? 'active' : ''}`}
            onClick={() => setUrgencyFilter(level)}
            data-testid={`notifications-filter-${level}`}
          >
            {level === 'all' ? 'All' : level === 'urgent' ? 'Urgent' : level === 'warning' ? 'Warning' : 'Info'}
          </button>
        ))}
      </div>
      <div className="notifications-list">
        {filteredNotifications.map((notification) => (
          <div key={notification.id} className="notification-item">
            <div className={getUrgencyDotClass(notification.urgency, notification.dot)} />
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

