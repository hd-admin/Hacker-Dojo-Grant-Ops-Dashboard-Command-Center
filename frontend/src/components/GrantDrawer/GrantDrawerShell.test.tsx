// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { GrantDrawerShell } from './GrantDrawerShell';

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

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

describe('GrantDrawerShell', () => {
  it('renders null when grantId is null', () => {
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: null,
        loading: false,
        onClose: vi.fn(),
        children: React.createElement('div', {}, 'Content'),
      }),
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog with correct accessibility attributes', async () => {
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: false,
        onClose: vi.fn(),
        children: React.createElement('div', {}, 'Content'),
      }),
    );
    await waitFor(() => container.querySelector("[role='dialog']") !== null);
    const dialog = container.querySelector("[role='dialog']");
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Grant details');
  });

  it('renders children when not loading', async () => {
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: false,
        onClose: vi.fn(),
        children: React.createElement('div', { 'data-testid': 'child' }, 'Child content'),
      }),
    );
    await waitFor(() => container.querySelector("[data-testid='child']") !== null);
    expect(container.textContent).toContain('Child content');
  });

  it('renders loading spinner when loading is true', async () => {
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: true,
        onClose: vi.fn(),
        children: React.createElement('div', {}, 'Content'),
      }),
    );
    await waitFor(() => container.querySelector("[role='status']") !== null);
    expect(container.querySelector('.spinner')).not.toBeNull();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it('renders close overlay button with accessible label', async () => {
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: false,
        onClose: vi.fn(),
        children: React.createElement('div', {}, 'Content'),
      }),
    );
    await waitFor(() => container.querySelector("[aria-label='Close grant drawer']") !== null);
  });

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn();
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: false,
        onClose,
        children: React.createElement('div', {}, 'Content'),
      }),
    );
    await waitFor(() => container.querySelector("[aria-label='Close grant drawer']") !== null);
    (container.querySelector("[aria-label='Close grant drawer']") as HTMLButtonElement)?.click();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: false,
        onClose,
        children: React.createElement('div', {}, 'Content'),
      }),
    );
    await waitFor(() => container.querySelector("[role='dialog']") !== null);
    (container.querySelector("[role='dialog']") as HTMLDivElement)?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('renders aside element for drawer', async () => {
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: false,
        onClose: vi.fn(),
        children: React.createElement('div', {}, 'Content'),
      }),
    );
    await waitFor(() => container.querySelector('aside.drawer') !== null);
  });

  it('does not render loading state children when loading', async () => {
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: true,
        onClose: vi.fn(),
        children: React.createElement('div', { 'data-testid': 'child' }, 'Content'),
      }),
    );
    await waitFor(() => container.querySelector("[role='status']") !== null);
    expect(container.querySelector("[data-testid='child']")).toBeNull();
  });

  it('handles focusable elements when present', async () => {
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: false,
        onClose: vi.fn(),
        children: React.createElement('button', { type: 'button' }, 'Focusable'),
      }),
    );
    await waitFor(() => container.textContent?.includes('Focusable') === true);
  });
});
