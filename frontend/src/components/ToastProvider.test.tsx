// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import { getByRole, getByText } from '../test-helpers';
import { ToastProvider, useToast } from './ToastProvider';

function TestComponent() {
  const { addToast } = useToast();
  return React.createElement(
    'div',
    null,
    React.createElement(
      'button',
      { onClick: () => addToast('Hello', 'success'), 'aria-label': 'Add success toast' },
      'Add Success',
    ),
    React.createElement(
      'button',
      { onClick: () => addToast('Error', 'error'), 'aria-label': 'Add error toast' },
      'Add Error',
    ),
  );
}

describe('ToastProvider', () => {
  it('renders children', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(ToastProvider, null, React.createElement('div', null, 'Child')),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(getByText(container, 'Child')).not.toBeNull();
    root.unmount();
    container.remove();
  });

  it('shows toast when addToast is called', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(ToastProvider, null, React.createElement(TestComponent, null)));
    await new Promise((r) => setTimeout(r, 50));
    const btn = getByRole(container, 'button', { name: 'Add success toast' }) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(getByText(container, 'Hello')).not.toBeNull();
    expect(getByRole(container, 'region')).not.toBeNull();
    root.unmount();
    container.remove();
  });

  it('shows error toast', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(React.createElement(ToastProvider, null, React.createElement(TestComponent, null)));
    await new Promise((r) => setTimeout(r, 50));
    const btn = getByRole(container, 'button', { name: 'Add error toast' }) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(getByText(container, 'Error')).not.toBeNull();
    root.unmount();
    container.remove();
  });
});
