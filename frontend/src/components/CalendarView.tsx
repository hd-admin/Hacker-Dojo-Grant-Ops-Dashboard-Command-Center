'use client';

import React, { useMemo, useState } from 'react';
import type { Grant } from '../../../shared/types';

interface CalendarEvent {
  date: string;
  type: 'grant_deadline' | 'report_due' | 'task_due';
  title: string;
  grantId?: string;
  urgency: 'overdue' | 'urgent' | 'soon' | 'normal';
  confidence?: 'exact' | 'estimated' | 'rolling' | 'unknown' | undefined;
}

interface CalendarViewProps {
  grants: Grant[];
  reportDeadlines?: { date: string; type: string; title: string }[];
  taskDueDates?: { date: string; text: string }[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getUrgency(dateStr: string): 'overdue' | 'urgent' | 'soon' | 'normal' {
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'urgent';
  if (diffDays <= 14) return 'soon';
  return 'normal';
}

function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'overdue': return 'var(--danger)';
    case 'urgent': return 'var(--warning)';
    case 'soon': return 'var(--warning)';
    case 'normal': return 'var(--info)';
    default: return 'var(--text-muted)';
  }
}

export default function CalendarView({ grants, reportDeadlines = [], taskDueDates = [] }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const events: CalendarEvent[] = useMemo(() => {
    const all: CalendarEvent[] = [];
    grants.forEach((g) => {
      if (g.deadline && g.deadlineConfidence !== 'rolling' && g.deadlineConfidence !== 'unknown') {
        all.push({
          date: g.deadline,
          type: 'grant_deadline',
          title: g.title,
          grantId: g.id,
          urgency: getUrgency(g.deadline),
          confidence: g.deadlineConfidence,
        });
      }
    });
    reportDeadlines.forEach((r) => {
      all.push({
        date: r.date,
        type: 'report_due',
        title: r.title,
        urgency: getUrgency(r.date),
      });
    });
    taskDueDates.forEach((t) => {
      all.push({
        date: t.date,
        type: 'task_due',
        title: t.text,
        urgency: getUrgency(t.date),
      });
    });
    all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return all;
  }, [grants, reportDeadlines, taskDueDates]);

  const upcomingEvents = useMemo(
    () => events.filter((e) => getUrgency(e.date) !== 'normal').slice(0, 10),
    [events],
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.date.startsWith(dateStr));
  };

  return (
    <div className="calendar-view" data-testid="calendar-view">
      <div className="header">
        <div>
          <h1 className="header-title">Calendar</h1>
          <div className="header-sub">Deadlines &amp; key dates</div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${viewMode === 'month' ? 'btn-active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            Month
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${viewMode === 'week' ? 'btn-active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
        </div>
      </div>

      <div className="calendar-legend">
        <span className="calendar-legend-item"><span className="calendar-dot" style={{ background: 'var(--danger)' }} /> Overdue</span>
        <span className="calendar-legend-item"><span className="calendar-dot" style={{ background: 'var(--warning)' }} /> Urgent (&lt;3 days)</span>
        <span className="calendar-legend-item"><span className="calendar-dot" style={{ background: 'var(--warning)' }} /> Soon (&lt;14 days)</span>
        <span className="calendar-legend-item"><span className="calendar-dot" style={{ background: 'var(--info)' }} /> Upcoming</span>
      </div>

      <div className="calendar-nav">
        <button type="button" className="btn btn-ghost btn-sm" onClick={prevMonth} aria-label="Previous month">←</button>
        <span className="calendar-month-label">{MONTHS[month]} {year}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={nextMonth} aria-label="Next month">→</button>
      </div>

      <div className="calendar-grid" role="grid" aria-label="Monthly calendar">
        {DAYS.map((d) => (
          <div key={d} className="calendar-day-header" role="columnheader">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-start-${i}`} className="calendar-day calendar-day-empty" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = getEventsForDay(day);
          return (
            <div key={day} className="calendar-day" role="gridcell">
              <span className="calendar-day-number">{day}</span>
              {dayEvents.map((evt, j) => (
                <div
                  key={j}
                  className="calendar-event"
                  style={{ background: getUrgencyColor(evt.urgency) }}
                  title={`${evt.title}${evt.confidence && evt.confidence !== 'exact' ? ` (${evt.confidence})` : ''}`}
                >
                  {evt.type === 'grant_deadline' ? '📅' : evt.type === 'report_due' ? '📋' : '✅'} {evt.title.slice(0, 20)}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="calendar-upcoming">
        <h3>Upcoming Deadlines</h3>
        {upcomingEvents.length === 0 ? (
          <div className="empty-state">No upcoming deadlines</div>
        ) : (
          upcomingEvents.map((evt, i) => (
            <div key={i} className="calendar-upcoming-item" style={{ borderLeftColor: getUrgencyColor(evt.urgency) }}>
              <span className="calendar-upcoming-date">{evt.date}</span>
              <span className="calendar-upcoming-title">
                {evt.title}
                {evt.confidence === 'estimated' && ' (~estimated)'}
                {evt.confidence === 'rolling' && ' (rolling)'}
              </span>
              <span className="calendar-upcoming-type">{evt.type.replace('_', ' ')}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
