// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { getByRole, getByText, getByLabelText } from '../test-helpers';
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

  it('switches to week view and renders week grid', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(CalendarView, { grants: [] }));
    await new Promise((r) => setTimeout(r, 100));

    const weekButton = getByText(container, 'Week') as HTMLElement;
    expect(weekButton).not.toBeNull();
    weekButton.click();
    await new Promise((r) => setTimeout(r, 100));

    const monthGrid = container.querySelector('[aria-label="Monthly calendar"]');
    expect(monthGrid).toBeNull();

    const weekGrid = container.querySelector('[aria-label="Weekly calendar"]');
    expect(weekGrid).not.toBeNull();

    const weekDays = Array.from(weekGrid!.querySelectorAll('[role="gridcell"]'));
    expect(weekDays.length).toBe(7);

    const dayNames = weekDays.map((el) =>
      el.querySelector('.calendar-week-day-name')?.textContent,
    );
    expect(dayNames).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

    root.unmount();
    container.remove();
  });

  it('shows week range label in week view', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(CalendarView, { grants: [] }));
    await new Promise((r) => setTimeout(r, 100));

    const weekButton = getByText(container, 'Week') as HTMLElement;
    weekButton.click();
    await new Promise((r) => setTimeout(r, 100));

    const label = container.querySelector('.calendar-month-label');
    expect(label).not.toBeNull();
    expect(label!.textContent).toMatch(/\w+ \d+ \u2013 \w+ \d+, \d{4}/);

    root.unmount();
    container.remove();
  });

  it('navigates weeks in week view', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(CalendarView, { grants: [] }));
    await new Promise((r) => setTimeout(r, 100));

    const weekButton = getByText(container, 'Week') as HTMLElement;
    weekButton.click();
    await new Promise((r) => setTimeout(r, 100));

    const prevButton = getByLabelText(container, 'Previous week');
    expect(prevButton).not.toBeNull();

    const nextButton = getByLabelText(container, 'Next week');
    expect(nextButton).not.toBeNull();

    const label = container.querySelector('.calendar-month-label');
    expect(label).not.toBeNull();
    const initialRange = label!.textContent;

    (nextButton as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 100));
    const nextRange = container.querySelector('.calendar-month-label')!.textContent;
    expect(nextRange).not.toBe(initialRange);

    (prevButton as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 100));
    const prevRange = container.querySelector('.calendar-month-label')!.textContent;
    expect(prevRange).toBe(initialRange);

    root.unmount();
    container.remove();
  });
});
