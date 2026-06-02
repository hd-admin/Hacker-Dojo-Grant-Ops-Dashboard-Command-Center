// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { getByText, queryByText } from '../test-helpers';
import { AgentActivityWidget } from './AgentActivityWidget';

vi.mock('lucide-react', () => ({
  Activity: () => <svg data-testid="activity-icon" />,
}));

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

describe('AgentActivityWidget', () => {
  it('renders loading state initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    root.render(<AgentActivityWidget />);
    await waitFor(() => queryByText(container, 'Loading activity...') !== null);
    vi.unstubAllGlobals();
  });

  it('renders empty state when no events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ events: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    root.render(<AgentActivityWidget />);
    await waitFor(() => queryByText(container, 'No recent agent activity') !== null);
    vi.unstubAllGlobals();
  });

  it('renders events list', async () => {
    const events = [
      {
        id: 'evt-1',
        eventType: 'crawl',
        description: 'Crawl completed',
        createdAt: '2026-05-20T10:00:00Z',
      },
      {
        id: 'evt-2',
        eventType: 'draft',
        description: 'Draft completed',
        createdAt: '2026-05-21T11:00:00Z',
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ events }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    root.render(<AgentActivityWidget />);
    await waitFor(() => queryByText(container, 'Recent Agent Activity') !== null);
    expect(getByText(container, 'Crawl completed')).not.toBeNull();
    expect(getByText(container, 'Draft completed')).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('handles fetch error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    root.render(<AgentActivityWidget />);
    await waitFor(() => queryByText(container, 'No recent agent activity') !== null);
    vi.unstubAllGlobals();
  });
});
