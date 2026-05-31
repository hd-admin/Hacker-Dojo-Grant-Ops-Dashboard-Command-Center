'use client';

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

export function ComplianceCalendar({ awardId }: ComplianceCalendarProps) {
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

  if (loading) return <div className="compliance-calendar" data-testid="compliance-calendar-loading">Loading...</div>;

  const sorted = [...items].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="compliance-calendar" data-testid="compliance-calendar">
      <div className="calendar-header">Compliance Calendar</div>
      <div className="calendar-list">
        {sorted.map((item) => {
          const isOverdue = new Date(item.dueDate) < new Date() && item.status !== 'submitted';
          const statusClass = isOverdue ? 'overdue' : item.status;
          return (
            <div key={item.id} className={`calendar-item ${statusClass}`} data-testid={`compliance-item-${item.id}`}>
              <div className="calendar-date">{new Date(item.dueDate).toLocaleDateString()}</div>
              <div className="calendar-title">{item.title}</div>
              <div className={`calendar-status ${statusClass}`}>{isOverdue ? 'overdue' : item.status}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

