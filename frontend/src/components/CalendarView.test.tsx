// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { getByRole, getByText } from '../test-helpers';
import { CalendarView } from './CalendarView';

describe('CalendarView', () => {
  it('renders month grid with days of week', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(CalendarView, { grants: [] }));
    await new Promise((r) => setTimeout(r, 100));
    expect(container.textContent).toContain('Calendar');
    const headers = Array.from(container.querySelectorAll('[role="columnheader"]')).map(
      (el) => el.textContent,
    );
    expect(headers.length).toBe(7);
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
    const upcomingHeading = getByRole(container, 'heading', { name: 'Upcoming Deadlines' });
    expect(upcomingHeading).not.toBeNull();
    expect(getByText(container, 'No upcoming deadlines')).not.toBeNull();
    root.unmount();
    container.remove();
  });

  it('renders calendar nav with month/year label', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(CalendarView, { grants: [] }));
    await new Promise((r) => setTimeout(r, 100));
    const monthLabel = getByText(container, /\w+ \d{4}/);
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
    expect(getByText(container, 'Overdue')).not.toBeNull();
    expect(getByText(container, 'Urgent')).not.toBeNull();
    root.unmount();
    container.remove();
  });
});
