// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';

describe('OperatorNamePrompt', () => {
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
    const module = await import('./OperatorNamePrompt');
    const { OperatorNamePrompt } = module;
    root.render(
      React.createElement(OperatorNamePrompt, {
        onSubmit: vi.fn(),
        ...props,
      }),
    );
    await new Promise((r) => setTimeout(r, 50));
    return container;
  }

  it('renders the prompt heading', async () => {
    const el = await render();
    expect(el.textContent).toContain('Hacker Dojo Grant Ops is ready.');
  });

  it('renders the subtitle', async () => {
    const el = await render();
    expect(el.textContent).toContain('What is your name?');
  });

  it('renders input field', async () => {
    const el = await render();
    const input = el.querySelector('input');
    expect(input).toBeTruthy();
    expect(input?.getAttribute('placeholder')).toBe('Your name');
  });

  it('renders Get Started button', async () => {
    const el = await render();
    const btn = el.querySelector('button');
    expect(btn?.textContent).toBe('Get Started');
  });

  it('shows error message when provided', async () => {
    const el = await render({ error: 'Name already exists' });
    expect(el.textContent).toContain('Name already exists');
  });

  it('shows Saving... when submitting', async () => {
    const el = await render({ isSubmitting: true });
    expect(el.textContent).toContain('Saving...');
  });

  it('has proper ARIA attributes', async () => {
    const el = await render();
    const dialog = el.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('calls onSubmit when button clicked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const el = await render({ onSubmit });
    const input = el.querySelector('input')!;
    const btn = el.querySelector('button')!;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(input, 'Alice');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    btn.click();
    expect(onSubmit).toHaveBeenCalledWith('Alice');
  });
});
