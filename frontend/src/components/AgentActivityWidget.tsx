'use client';

import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

interface ActivityEvent {
  id: string;
  eventType: string;
  description: string;
  createdAt: string;
  metadata?: string;
}

export function AgentActivityWidget() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/audit');
        const data = await res.json();
        if (!cancelled) setEvents(Array.isArray(data.events) ? data.events.slice(0, 10) : []);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadEvents();
    const interval = setInterval(loadEvents, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) {
    return <div className="agent-activity-widget" data-testid="agent-activity-loading">Loading activity...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="agent-activity-widget empty" data-testid="agent-activity-empty">
        <Activity size={24} aria-hidden="true" />
        <p>No recent agent activity</p>
      </div>
    );
  }

  return (
    <div className="agent-activity-widget" data-testid="agent-activity-widget">
      <div className="widget-header">
        <Activity size={16} aria-hidden="true" />
        <span>Recent Agent Activity</span>
      </div>
      <div className="activity-list">
        {events.map((evt) => (
          <div key={evt.id} className="activity-item" data-testid={`activity-${evt.id}`}>
            <div className="activity-dot info" />
            <div>
              <div className="activity-text">{evt.description}</div>
              <div className="activity-time">{new Date(evt.createdAt).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

