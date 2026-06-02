// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { getByRole, getByText, queryByRole, queryByText } from '../../test-helpers';
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
    await waitFor(() => queryByRole(container, 'dialog') !== null);
    const dialog = getByRole(container, 'dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Grant details');
  });

  it('renders children when not loading', async () => {
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: false,
        onClose: vi.fn(),
        children: React.createElement('div', {}, 'Child content'),
      }),
    );
    await waitFor(() => queryByText(container, 'Child content') !== null);
    expect(getByText(container, 'Child content')).not.toBeNull();
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
    await waitFor(() => queryByRole(container, 'status') !== null);
    expect(getByRole(container, 'status')).not.toBeNull();
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
    await waitFor(() => queryByRole(container, 'button', { name: 'Close grant drawer' }) !== null);
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
    await waitFor(() => queryByRole(container, 'button', { name: 'Close grant drawer' }) !== null);
    getByRole(container, 'button', { name: 'Close grant drawer' }).click();
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
    await waitFor(() => queryByRole(container, 'dialog') !== null);
    getByRole(container, 'dialog').dispatchEvent(
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
    await waitFor(() => queryByRole(container, 'complementary') !== null);
  });

  it('does not render loading state children when loading', async () => {
    root.render(
      React.createElement(GrantDrawerShell, {
        grantId: 'g1',
        loading: true,
        onClose: vi.fn(),
        children: React.createElement('div', {}, 'Content'),
      }),
    );
    await waitFor(() => queryByRole(container, 'status') !== null);
    expect(queryByText(container, 'Content')).toBeNull();
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
    await waitFor(() => queryByRole(container, 'button', { name: 'Focusable' }) !== null);
  });
});
