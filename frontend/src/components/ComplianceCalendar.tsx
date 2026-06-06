import type { JSX } from 'react';
'use client';

// This component must remain a Client Component because it uses:
// - useState and useEffect (React hooks)
// - fetch() for client-side data loading

import React, { useEffect, useState } from 'react';

interface ComplianceItem {
  id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'overdue' | 'submitted';
  awardId: string;
}

interface ComplianceCalendarProps {
  awardId?: string;
}

export function ComplianceCalendar({ awardId }: ComplianceCalendarProps): JSX.Element {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadItems = async () => {
      try {
        const url = awardId ? `/api/awards/${awardId}/compliance` : '/api/calendar/reports';
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadItems();
  }, [awardId]);

  if (loading)
    return (
      <div className="compliance-calendar" role="status" aria-label="Loading compliance calendar">
        Loading...
      </div>
    );

  const sorted = [...items].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );

  return (
    <div className="compliance-calendar" role="region" aria-label="Compliance Calendar">
      <div className="calendar-header">Compliance Calendar</div>
      <div className="calendar-list" role="list">
        {sorted.map((item) => {
          const isOverdue = new Date(item.dueDate) < new Date() && item.status !== 'submitted';
          const statusClass = isOverdue ? 'overdue' : item.status;
          return (
            <div key={item.id} className={`calendar-item ${statusClass}`} role="listitem">
              <div className="calendar-date">{new Date(item.dueDate).toLocaleDateString()}</div>
              <div className="calendar-title">{item.title}</div>
              <div className={`calendar-status ${statusClass}`}>
                {isOverdue ? 'overdue' : item.status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
