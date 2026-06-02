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

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ name: '' }),
      }),
    );
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    });
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render(props: Record<string, unknown> = {}) {
    const module = await import('./OperatorNamePrompt');
    const { OperatorNamePrompt } = module;
    root.render(React.createElement(OperatorNamePrompt, props));
    await new Promise((r) => setTimeout(r, 100));
    return container;
  }

  it('renders the prompt heading', async () => {
    const el = await render();
    const heading = el.querySelector('h1');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe('Hacker Dojo Grant Ops is ready.');
  });

  it('renders the subtitle', async () => {
    const el = await render();
    const subtitle = el.querySelector('p');
    expect(subtitle?.textContent).toBe('What is your name?');
  });

  it('renders input field with accessible label', async () => {
    const el = await render();
    const input = el.querySelector('input');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('aria-label')).toBe('Your name');
    expect(input?.getAttribute('placeholder')).toBe('Your name');
  });

  it('renders Get Started button with accessible name', async () => {
    const el = await render();
    const btn = el.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toBe('Get started');
    expect(btn?.textContent).toBe('Get Started');
  });

  it('shows error message via alert role when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ json: () => Promise.resolve({ name: '' }) }) // initial check
        .mockRejectedValueOnce(new Error('Network error')), // save call
    );
    const el = await render();
    const input = el.querySelector('input')!;
    const btn = el.querySelector('button')!;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(input, 'Alice');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    btn.click();
    await new Promise((r) => setTimeout(r, 50));

    const alert = el.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Failed to save name');
  });

  it('has proper ARIA dialog attributes', async () => {
    const el = await render();
    const dialog = el.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('operator-prompt-title');
  });

  it('calls onComplete when button clicked after save', async () => {
    const onComplete = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ json: () => Promise.resolve({ name: '' }) }) // initial check
        .mockResolvedValueOnce({ json: () => Promise.resolve({ name: 'Alice' }) }), // save call
    );

    const el = await render({ onComplete });
    const input = el.querySelector('input')!;
    const btn = el.querySelector('button')!;

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(input, 'Alice');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    btn.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(onComplete).toHaveBeenCalledWith('Alice');
  });

  it('does not submit with empty name', async () => {
    const onComplete = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve({ name: '' }) }), // initial check
    );

    const el = await render({ onComplete });
    const btn = el.querySelector('button')!;

    btn.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('skips prompt when existing name found in localStorage', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('ExistingUser'),
      setItem: vi.fn(),
    });
    const onComplete = vi.fn();

    const module = await import('./OperatorNamePrompt');
    const { OperatorNamePrompt } = module;
    root.render(React.createElement(OperatorNamePrompt, { onComplete }));
    await new Promise((r) => setTimeout(r, 100));

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
    expect(onComplete).toHaveBeenCalledWith('ExistingUser');
  });

  it('skips prompt when existing name found from /api/operator', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve({ name: 'ServerUser' }) }),
    );
    const onComplete = vi.fn();

    const module = await import('./OperatorNamePrompt');
    const { OperatorNamePrompt } = module;
    root.render(React.createElement(OperatorNamePrompt, { onComplete }));
    await new Promise((r) => setTimeout(r, 100));

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
    expect(onComplete).toHaveBeenCalledWith('ServerUser');
  });
});
