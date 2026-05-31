// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { CalendarView } from './CalendarView';

describe('CalendarView', () => {
  it('renders month grid with days of week', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(CalendarView, { grants: [] }));
    await new Promise((r) => setTimeout(r, 100));
    expect(container.querySelector('[data-testid="calendar-view"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="columnheader"]').length).toBe(7);
    const headers = Array.from(container.querySelectorAll('[role="columnheader"]'))
      .map((el) => el.textContent);
    expect(headers).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    root.unmount();
    container.remove();
  });

  it('shows empty state for no upcoming deadlines', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(CalendarView, { grants: [] }));
    await new Promise((r) => setTimeout(r, 100));
    const upcomingSection = container.querySelector('.calendar-upcoming');
    expect(upcomingSection).not.toBeNull();
    const allText = container.textContent ?? '';
    expect(allText).toContain('No upcoming deadlines');
    root.unmount();
    container.remove();
  });

  it('renders calendar nav with month/year label', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(CalendarView, { grants: [] }));
    await new Promise((r) => setTimeout(r, 100));
    const monthLabel = container.querySelector('.calendar-month-label');
    expect(monthLabel).not.toBeNull();
    root.unmount();
    container.remove();
  });

  it('shows legend for urgency colors', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(CalendarView, { grants: [] }));
    await new Promise((r) => setTimeout(r, 100));
    expect(container.querySelector('.calendar-legend')).not.toBeNull();
    root.unmount();
    container.remove();
  });
});
