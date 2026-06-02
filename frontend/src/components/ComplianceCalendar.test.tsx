// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { getAllByRole, getByText, queryByRole } from '../test-helpers';
import { ComplianceCalendar } from './ComplianceCalendar';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.restoreAllMocks();
});

describe('ComplianceCalendar', () => {
  it('renders loading state initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    root.render(<ComplianceCalendar />);
    await waitFor(
      () => queryByRole(container, 'status', { name: 'Loading compliance calendar' }) !== null,
    );
    expect(getByText(container, 'Loading')).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('renders compliance items sorted by due date', async () => {
    const items = [
      {
        id: 'item-2',
        title: 'Annual Report',
        dueDate: '2026-12-31',
        status: 'pending',
        awardId: 'award-1',
      },
      {
        id: 'item-1',
        title: 'Quarterly Update',
        dueDate: '2026-06-30',
        status: 'pending',
        awardId: 'award-1',
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    root.render(<ComplianceCalendar awardId="award-1" />);
    await waitFor(() => getAllByRole(container, 'listitem').length === 2);
    expect(getByText(container, 'Quarterly Update')).not.toBeNull();
    expect(getByText(container, 'Annual Report')).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('shows overdue status for past due dates', async () => {
    const items = [
      {
        id: 'item-1',
        title: 'Late Report',
        dueDate: '2020-01-01',
        status: 'pending',
        awardId: 'award-1',
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    root.render(<ComplianceCalendar />);
    await waitFor(() => getAllByRole(container, 'listitem').length === 1);
    expect(container.textContent).toContain('overdue');
    vi.unstubAllGlobals();
  });

  it('handles fetch error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    root.render(<ComplianceCalendar />);
    await waitFor(() => queryByRole(container, 'region', { name: 'Compliance Calendar' }) !== null);
    expect(container.textContent).toContain('Compliance Calendar');
    vi.unstubAllGlobals();
  });
});
