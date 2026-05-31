'use client';

import React, { useEffect, useState } from 'react';
import type { AuditEvent } from '../../../shared/types';

interface AuditViewProps {
  entityId?: string;
  entityType?: string;
}

export function AuditView({ entityId, entityType }: AuditViewProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const url = new URL('/api/audit', window.location.origin);
        if (entityId) url.searchParams.set('entityId', entityId);
        if (entityType) url.searchParams.set('entityType', entityType);
        const response = await fetch(url.toString());
        const data = (await response.json()) as AuditEvent[];
        setEvents(Array.isArray(data) ? data : []);
      } catch (_error) {
        setError('Error loading audit events');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [entityId, entityType]);

  if (loading) {
    return <div className="header-title">Loading audit trail...</div>;
  }

  return (
    <div className="panel" data-testid="audit-view">
      <div className="panel-header">
        <div className="panel-title">Audit Trail</div>
      </div>
      {events.length === 0 ? (
        <div className="empty-state">
          No audit events yet. Audit events are recorded automatically as you work — run discovery, approve drafts, or manage sources to generate activity.
        </div>
      ) : (
        <div className="activity-list">
          {events.slice(0, 25).map((event) => (
            <div key={event.id} className="activity-item">
              <div>
                <div className="activity-text">
                  <strong>{event.eventType}</strong> · {event.entityType} {event.entityId}
                </div>
                <div className="activity-time">{new Date(event.timestamp).toLocaleString()}</div>
                {event.metadata && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(event.metadata, null, 2)}</pre>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

