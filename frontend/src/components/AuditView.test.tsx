// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { AuditEvent } from '../../../shared/types';

const { onRefreshAppState } = vi.hoisted(() => ({
  onRefreshAppState: vi.fn(),
}));

import { AuditView } from './AuditView';

const auditEvents: AuditEvent[] = [
  {
    id: 'event-1',
    eventType: 'grant.created',
    entityType: 'grant',
    entityId: 'grant-123',
    actorLabel: 'System',
    timestamp: '2026-05-28T10:00:00.000Z',
    metadata: { userId: 'user-1', grantName: 'AI Literacy Program' },
  },
  {
    id: 'event-2',
    eventType: 'document.uploaded',
    entityType: 'document',
    entityId: 'doc-456',
    actorLabel: 'System',
    timestamp: '2026-05-28T11:30:00.000Z',
  },
  {
    id: 'event-3',
    eventType: 'grant.submitted',
    entityType: 'grant',
    entityId: 'grant-123',
    actorLabel: 'System',
    timestamp: '2026-05-28T12:00:00.000Z',
    metadata: { submittedBy: 'user-1', threshold: 75 },
  },
];

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
  onRefreshAppState.mockReset();

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/audit')) {
      return new Response(JSON.stringify(auditEvents), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  }));

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AuditView', () => {
  it('renders the "Audit Trail" panel header', async () => {
    root.render(React.createElement(AuditView));
    await waitFor(() => container.textContent?.includes('Audit Trail') === true);
    expect(container.textContent).toContain('Audit Trail');
  });

  it('shows loading state ("Loading audit trail...") initially', async () => {
    // Block fetch so loading state persists long enough to assert
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    root.render(React.createElement(AuditView));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(container.textContent).toContain('Loading audit trail...');
  });

  it('shows empty state ("No audit events yet.") when no events returned', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response(JSON.stringify([]), { headers: { 'content-type': 'application/json' } });
    }));

    root.render(React.createElement(AuditView));
    await waitFor(() => container.textContent?.includes('No audit events yet.') === true);
    expect(container.textContent).toContain('No audit events yet.');
  });

  it('shows audit events when API returns data', async () => {
    root.render(React.createElement(AuditView));
    await waitFor(() => container.textContent?.includes('grant.created') === true);
    expect(container.textContent).toContain('grant.created');
    expect(container.textContent).toContain('document.uploaded');
    expect(container.textContent).toContain('grant.submitted');
  });

  it('supports entityId query parameter filtering', async () => {
    const fetchMock = vi.mocked(global.fetch as unknown as typeof fetch);
    root.render(React.createElement(AuditView, { entityId: 'grant-123' }));
    await waitFor(() => container.textContent?.includes('Audit Trail') === true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('entityId=grant-123'),
    );
  });

  it('supports entityType query parameter filtering', async () => {
    const fetchMock = vi.mocked(global.fetch as unknown as typeof fetch);
    root.render(React.createElement(AuditView, { entityType: 'grant' }));
    await waitFor(() => container.textContent?.includes('Audit Trail') === true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('entityType=grant'),
    );
  });

  it('shows event type, entity type/ID, and timestamp for each event', async () => {
    root.render(React.createElement(AuditView));
    await waitFor(() => container.textContent?.includes('grant.created') === true);

    expect(container.textContent).toContain('grant.created');
    expect(container.textContent).toContain('grant grant-123');
    expect(container.textContent).toContain('5/28/2026');

    expect(container.textContent).toContain('document.uploaded');
    expect(container.textContent).toContain('document doc-456');

    expect(container.textContent).toContain('grant.submitted');
    expect(container.textContent).toContain('grant grant-123');
  });

  it('shows metadata as JSON when present', async () => {
    root.render(React.createElement(AuditView));
    await waitFor(() => container.textContent?.includes('grant.created') === true);

    expect(container.textContent).toContain('"userId"');
    expect(container.textContent).toContain('"grantName"');
    expect(container.textContent).toContain('"AI Literacy Program"');
  });
});
