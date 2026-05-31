// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';

describe('MiniProgressBar', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  async function render(props: Record<string, unknown> = {}) {
    const { MiniProgressBar } = await import('./MiniProgressBar');
    root.render(
      React.createElement(MiniProgressBar, {
        jobType: 'research',
        stage: 'Searching...',
        progress: 50,
        status: 'running',
        ...props,
      }),
    );
    await new Promise((r) => setTimeout(r, 50));
    return container;
  }

  it('renders with running status', async () => {
    const el = await render({ stage: 'Searching for grants...' });
    expect(el.textContent).toContain('Searching for grants...');
  });

  it('shows progress bar with correct aria attributes', async () => {
    const el = await render({ jobType: 'draft', progress: 75 });
    const bar = el.querySelector('[role="progressbar"]');
    expect(bar).toBeTruthy();
    expect(bar?.getAttribute('aria-valuenow')).toBe('75');
  });

  it('shows cancel button for active jobs', async () => {
    const onCancel = vi.fn();
    const el = await render({ status: 'running', onCancel });
    const btn = el.querySelector('button');
    btn?.click();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows error message for failed jobs', async () => {
    const el = await render({
      status: 'failed',
      errorMessage: 'Timeout after 300s',
    });
    expect(el.textContent).toContain('Timeout after 300s');
  });

  it('shows log button for failed jobs', async () => {
    const onViewLog = vi.fn();
    const el = await render({ status: 'failed', onViewLog });
    const buttons = el.querySelectorAll('button');
    const logBtn = Array.from(buttons).find((b) => b.textContent?.includes('Log'));
    logBtn?.click();
    expect(onViewLog).toHaveBeenCalledOnce();
  });

  it('has aria-live region', async () => {
    const el = await render();
    const bar = el.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-live')).toBe('polite');
  });
});
