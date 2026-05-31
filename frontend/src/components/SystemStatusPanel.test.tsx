// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { SystemStatusPanel } from './SystemStatusPanel';

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

describe('SystemStatusPanel', () => {
  it('renders loading state initially', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    root.render(<SystemStatusPanel />);
    await waitFor(() => container.querySelector('[data-testid="system-status-loading"]') !== null);
    expect(container.textContent).toContain('Checking system status');
    vi.unstubAllGlobals();
  });

  it('renders fully online status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ storage: 'ok', opencode: 'ok', crawlerStatus: 'ok' }), {
        headers: { 'content-type': 'application/json' },
      }),
    ));
    root.render(<SystemStatusPanel />);
    await waitFor(() => container.querySelector('[data-testid="system-status-panel"]') !== null);
    expect(container.textContent).toContain('Fully Online');
    expect(container.querySelector('[data-testid="status-storage"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="status-opencode"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="status-crawler"]')).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('renders partially degraded status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ storage: 'ok', opencode: 'error', crawlerStatus: 'ok' }), {
        headers: { 'content-type': 'application/json' },
      }),
    ));
    root.render(<SystemStatusPanel />);
    await waitFor(() => container.querySelector('[data-testid="system-status-panel"]') !== null);
    expect(container.textContent).toContain('Partially Degraded');
    vi.unstubAllGlobals();
  });

  it('renders fully offline on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    root.render(<SystemStatusPanel />);
    await waitFor(() => container.querySelector('[data-testid="system-status-panel"]') !== null);
    expect(container.textContent).toContain('Fully Offline');
    vi.unstubAllGlobals();
  });
});
