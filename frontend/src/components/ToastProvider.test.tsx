// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import ToastProvider, { useToast } from './ToastProvider';

function TestComponent() {
  const { addToast } = useToast();
  return React.createElement('div', null,
    React.createElement('button', { onClick: () => addToast('Hello', 'success'), 'data-testid': 'add-success' }, 'Add Success'),
    React.createElement('button', { onClick: () => addToast('Error', 'error'), 'data-testid': 'add-error' }, 'Add Error')
  );
}

describe('ToastProvider', () => {
  it('renders children', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(ToastProvider, null,
        React.createElement('div', { 'data-testid': 'child' }, 'Child')
      )
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent).toContain('Child');
    root.unmount();
    container.remove();
  });

  it('shows toast when addToast is called', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(ToastProvider, null,
        React.createElement(TestComponent, null)
      )
    );
    await new Promise((r) => setTimeout(r, 50));
    const btn = container.querySelector('[data-testid="add-success"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent).toContain('Hello');
    root.unmount();
    container.remove();
  });

  it('shows error toast', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(
      React.createElement(ToastProvider, null,
        React.createElement(TestComponent, null)
      )
    );
    await new Promise((r) => setTimeout(r, 50));
    const btn = container.querySelector('[data-testid="add-error"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent).toContain('Error');
    root.unmount();
    container.remove();
  });
});
