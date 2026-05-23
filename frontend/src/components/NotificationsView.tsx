'use client';

import { useState, useEffect } from 'react';
import type { Notification } from '../../../shared/types';
import { seedNotifications } from '../../../shared/seed-data';
import { notificationsApi } from '../lib/grant-ops-client';

export default function NotificationsView() {
  const [notifications, setNotifications] = useState<Notification[]>(seedNotifications);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return <div className="header-title">Loading...</div>;
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
        <div className="empty-state">
          <p>No notifications yet.</p>
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
              <div className="notification-text">{notification.text}</div>
              <div className="notification-time">{notification.time}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
